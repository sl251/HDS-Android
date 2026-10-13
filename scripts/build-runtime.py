"""Build a pinned ARM64 guest and import only checksum-verified PRoot artifacts.

Requires Linux, Python >=3.12, npm and binutils. Does not run QQ or SnowLuma.
"""
import copy
import hashlib
import io
import json
import os
import stat
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

def pack_guest(guest, archive):
    """Write every inode as a file, while preserving symbolic links exactly."""
    with tarfile.open(archive, 'w:gz', compresslevel=6) as bundle:
        paths = [guest]
        for directory, directories, files in os.walk(guest, followlinks=False):
            directories.sort()
            files.sort()
            paths.extend(Path(directory) / name for name in directories + files)
        for path in paths:
            info = path.lstat()
            entry = tarfile.TarInfo('.' if path == guest else './' + path.relative_to(guest).as_posix())
            entry.mode = stat.S_IMODE(info.st_mode) & 0o777
            entry.mtime = 0
            if stat.S_ISLNK(info.st_mode):
                entry.type = tarfile.SYMTYPE
                entry.linkname = os.readlink(path)
                bundle.addfile(entry)
            elif stat.S_ISDIR(info.st_mode):
                entry.type = tarfile.DIRTYPE
                bundle.addfile(entry)
            elif stat.S_ISREG(info.st_mode):
                entry.size = info.st_size
                with path.open('rb') as stream: bundle.addfile(entry, stream)
            else: raise RuntimeError(f'Unsupported guest entry: {entry.name}')
    return audit_guest(archive)

def audit_guest(archive):
    entries = {}
    expanded = 0
    symbols = 0
    with tarfile.open(archive, 'r:gz') as source:
        for entry in source:
            parts = PurePosixPath(entry.name).parts
            name = '/'.join(parts)
            if entry.name.startswith('/') or '..' in parts or name in entries: raise RuntimeError('Unsafe/duplicate archive entry')
            entries[name] = entry
            if entry.islnk(): raise RuntimeError('Guest archive must not contain hardlinks')
            if entry.issym(): symbols += 1
            elif entry.isfile(): expanded += entry.size
            elif not entry.isdir(): raise RuntimeError('Unsupported guest archive entry')
    for name, entry in entries.items():
        parent = PurePosixPath(name).parent
        while str(parent) != '.':
            if str(parent) in entries and not entries[str(parent)].isdir(): raise RuntimeError('Guest parent is not a directory')
            parent = parent.parent
        if not entry.issym(): continue
        if not entry.linkname or entry.linkname.startswith('/'): raise RuntimeError('Absolute/empty guest symlink')
        parts = list(PurePosixPath(name).parent.parts)
        pending = entry.linkname.split('/')
        expansions = 0
        while pending:
            part = pending.pop(0)
            if part in ('', '.'): continue
            if part == '..':
                if not parts: raise RuntimeError('Guest symlink escapes root')
                parts.pop()
            else:
                parts.append(part)
                link = entries.get('/'.join(parts))
                if link and link.issym():
                    expansions += 1
                    if expansions > 256: raise RuntimeError('Guest symlink cycle')
                    if not link.linkname or link.linkname.startswith('/'): raise RuntimeError('Absolute/empty guest symlink')
                    parts.pop()
                    pending = link.linkname.split('/') + pending
    for required in ['opt/node/bin/node', 'opt/hds/host.cjs']:
        if required not in entries or not entries[required].isfile(): raise RuntimeError(f'Missing guest file: {required}')
    return {'expandedBytes': expanded, 'entries': len(entries), 'hardlinks': 0, 'symlinks': symbols}

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
    # ubuntu-base ships libssl but no /etc/ssl/openssl.cnf; Node's OpenSSL then dies reading the
    # missing default config inside PRoot ("BIO_new_file ... Function not implemented"), so the
    # guest must always carry a minimal but valid config file at the expected path.
    (GUEST / 'etc/ssl').mkdir(exist_ok=True)
    (GUEST / 'etc/ssl/openssl.cnf').write_text(
        '# Minimal OpenSSL configuration for the HDS Android guest.\n'
        '# Node only needs a syntactically valid file; defaults apply for everything else.\n'
        'openssl_conf = openssl_init\n\n'
        '[openssl_init]\n'
        'providers = provider_sect\n\n'
        '[provider_sect]\n'
        'default = default_sect\n\n'
        '[default_sect]\n'
        'activate = 1\n')
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
    audit = pack_guest(GUEST, archive)
    expanded = audit['expandedBytes']
    manifest = {'version': LOCK['version'], 'abi': LOCK['abi'], 'compressedBytes': archive.stat().st_size, 'expandedBytes': expanded, 'archiveAudit': audit, 'sha256': digest(archive), 'prootSha256': reference['prootSha256'], 'loaderSha256': reference['loaderSha256'], 'sourceLock': LOCK}
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    (WORK / 'runtime-manifest.json').write_text(json.dumps(manifest, indent=2))
    print(f'Built runtime: {archive.stat().st_size // 1024 // 1024} MiB compressed / {expanded // 1024 // 1024} MiB expanded', flush=True)

if __name__ == '__main__': main()
