"""Build a pinned ARM64 guest and import only checksum-verified PRoot artifacts.

Requires Linux, Python >=3.12, npm and binutils. Does not run QQ or SnowLuma.
"""
import copy
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
LOCK = json.loads((ROOT / 'runtime/sources.lock.json').read_text())
WORK = ROOT / 'runtime/generated'
GUEST = WORK / 'rootfs'
DOWNLOADS = WORK / 'downloads'
ASSETS = ROOT / 'android/app/src/main/assets/runtime'
NATIVE = ROOT / 'android/app/src/main/jniLibs/arm64-v8a'
LEGAL = ROOT / 'android/app/src/main/assets/legal'

def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): value.update(block)
    return value.hexdigest()

def download(spec, filename):
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    target = DOWNLOADS / filename
    if target.exists() and digest(target) == spec['sha256']: return target
    request = urllib.request.Request(spec['url'], headers={'User-Agent': 'HDS-Android-runtime-build/0.1'})
    with urllib.request.urlopen(request, timeout=90) as response, target.open('wb') as stream:
        shutil.copyfileobj(response, stream, 1024 * 1024)
    if digest(target) != spec['sha256']: raise RuntimeError(f'SHA-256 mismatch: {filename}')
    print(f'Verified {filename} ({target.stat().st_size} bytes)', flush=True)
    return target

def unpack(archive, destination, strip=0):
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=archive if hasattr(archive, 'read') else None, name=None if hasattr(archive, 'read') else archive, mode='r:*') as source:
        for original in source:
            entry = copy.copy(original)
            parts = PurePosixPath(entry.name).parts
            if parts and parts[0] == '.': parts = parts[1:]
            parts = parts[strip:]
            if not parts: continue
            if any(part == '..' for part in parts) or entry.name.startswith('/'): raise RuntimeError('Unsafe runtime source path')
            entry.name = '/'.join(parts)
            if entry.isdev() or entry.isfifo(): continue
            if entry.issym():
                target = entry.linkname
                if target.startswith('/'): target = os.path.relpath(target.lstrip('/'), str(PurePosixPath(entry.name).parent))
                entry.linkname = target
            elif entry.islnk():
                entry.linkname = '/'.join(PurePosixPath(entry.linkname).parts[strip:])
            source.extract(entry, destination, filter='data')

def main():
    if os.name != 'posix': raise SystemExit('Run in Linux CI; Windows cannot represent the guest filesystem')
    WORK.mkdir(parents=True, exist_ok=True)
    if GUEST.exists():
        if not GUEST.resolve().is_relative_to(WORK.resolve()): raise RuntimeError('Guest cleanup target escaped workspace')
        shutil.rmtree(GUEST)
    unpack(download(LOCK['ubuntu'], 'ubuntu-arm64.tar.gz'), GUEST)
    unpack(download(LOCK['node'], 'node-arm64.tar.xz'), GUEST / 'opt/node', strip=1)
    for deb in LOCK['debs']:
        archive = download(deb, deb['name'] + '.deb')
        members = subprocess.check_output(['ar', 't', str(archive)], text=True).splitlines()
        data = next(name for name in members if name.startswith('data.tar.'))
        content = subprocess.check_output(['ar', 'p', str(archive), data])
        if data.endswith('.zst'): content = subprocess.check_output(['zstd', '-d', '-c'], input=content)
        unpack(io.BytesIO(content), GUEST)
    (GUEST / 'etc/resolv.conf').unlink(missing_ok=True)
    (GUEST / 'etc/resolv.conf').write_text('nameserver 1.1.1.1\n')
    for name in ['tmp', 'proc', 'dev', 'hds-data', 'root']:
        (GUEST / name).mkdir(exist_ok=True)
    os.chmod(GUEST / 'tmp', 0o1777)
    profile = GUEST / 'opt/hds'
    profile.mkdir(parents=True, exist_ok=True)
    for name in ['package.json', 'package-lock.json']: shutil.copyfile(ROOT / 'runtime/profile' / name, profile / name)
    subprocess.run(['npm', 'ci', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], cwd=profile, check=True)
    shutil.copyfile(WORK / 'host.cjs', profile / 'host.cjs')
    shutil.copyfile(ROOT / 'upstream/hds-interlude/LICENSE', profile / 'HDS-LICENSE')
    LEGAL.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / 'docs/THIRD_PARTY.md', LEGAL / 'THIRD_PARTY.md')
    shutil.copyfile(ROOT / 'upstream/hds-interlude/LICENSE', LEGAL / 'HDS-AGPL-3.0.txt')
    shutil.copyfile(GUEST / 'opt/node/LICENSE', LEGAL / 'Node-LICENSE.txt')
    reference = LOCK['runnerReference']
    apk = download(reference, 'reference.apk')
    NATIVE.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(apk) as bundle:
        for entry, filename, expected in [(reference['prootEntry'], 'libhds_proot.so', reference['prootSha256']), (reference['loaderEntry'], 'libhds_loader.so', reference['loaderSha256'])]:
            content = bundle.read(entry)
            if hashlib.sha256(content).hexdigest() != expected: raise RuntimeError(f'Runner artifact mismatch: {entry}')
            if content[:4] != b'\x7fELF' or int.from_bytes(content[18:20], 'little') != 183: raise RuntimeError('Runner is not ARM64 ELF')
            (NATIVE / filename).write_bytes(content)
            os.chmod(NATIVE / filename, 0o755)
        for entry in bundle.namelist():
            if entry.startswith('assets/legal/') and not entry.endswith('/'):
                target = LEGAL / 'runner-reference' / entry.removeprefix('assets/legal/')
                if '..' in PurePosixPath(entry).parts: raise RuntimeError('Unsafe legal reference path')
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(bundle.read(entry))
    # Carry exact npm package notices and Ubuntu copyright files alongside binaries.
    for package in (profile / 'node_modules').rglob('package.json'):
        if not package.is_file(): continue
        value = json.loads(package.read_text())
        if not value.get('name'): continue
        target = LEGAL / 'npm' / value['name'].replace('/', '__')
        target.mkdir(parents=True, exist_ok=True)
        (target / 'package.json').write_text(json.dumps({key: value.get(key) for key in ['name', 'version', 'license', 'repository']}, indent=2))
        for notice in package.parent.iterdir():
            if notice.is_file() and notice.name.lower().startswith(('license', 'copying', 'notice')): shutil.copyfile(notice, target / notice.name)
    for copyright_file in (GUEST / 'usr/share/doc').rglob('copyright'):
        target = LEGAL / 'ubuntu' / copyright_file.relative_to(GUEST / 'usr/share/doc')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(copyright_file, target)
    ASSETS.mkdir(parents=True, exist_ok=True)
    archive = ASSETS / 'rootfs.bundle'  # .gz suffix is stripped by AAPT; contents remain gzip.
    with tarfile.open(archive, 'w:gz', compresslevel=6) as bundle: bundle.add(GUEST, arcname='.')
    expanded = sum(file.stat().st_size for file in GUEST.rglob('*') if file.is_file() and not file.is_symlink())
    manifest = {'version': LOCK['version'], 'abi': LOCK['abi'], 'compressedBytes': archive.stat().st_size, 'expandedBytes': expanded, 'sha256': digest(archive), 'prootSha256': reference['prootSha256'], 'loaderSha256': reference['loaderSha256'], 'sourceLock': LOCK}
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (WORK / 'runtime-manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Built runtime: {archive.stat().st_size // 1024 // 1024} MiB compressed / {expanded // 1024 // 1024} MiB expanded', flush=True)

if __name__ == '__main__': main()
