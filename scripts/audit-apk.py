"""Read-only APK/rootfs audit. Uses Python 3.11+, standard library only.

Example: python audit_apk.py app.apk --output apk-audit.json
No archive entry is extracted or executed.
"""
import argparse
import collections
import hashlib
import json
import pathlib
import posixpath
import tarfile
import zipfile


def sha256(stream):
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(chunk)
    return digest.hexdigest()


def audit(apk):
    with apk.open('rb') as stream:
        apk_hash = sha256(stream)
    with zipfile.ZipFile(apk) as package:
        manifest = json.loads(package.read('assets/runtime/manifest.json'))
        with package.open('assets/runtime/rootfs.bundle') as stream:
            bundle_hash = sha256(stream)
        bundle_size = package.getinfo('assets/runtime/rootfs.bundle').file_size
        with package.open('assets/runtime/rootfs.bundle') as stream:
            with tarfile.open(fileobj=stream, mode='r|gz') as archive:
                members = list(archive)

    by_name = {posixpath.normpath(entry.name): entry for entry in members}

    def resolve(entry):
        seen = set()
        while entry.islnk():
            name = posixpath.normpath(entry.name)
            if name in seen:
                return {'error': 'cycle'}
            seen.add(name)
            target = posixpath.normpath(entry.linkname)
            if target not in by_name:
                return {'error': 'missing', 'target': target}
            entry = by_name[target]
        return {'type': entry.type.decode('ascii', 'replace'),
                'size': entry.size, 'mode': oct(entry.mode), 'target': entry.name}

    hardlinks = [
        {'index': i, 'path': entry.name, 'target': entry.linkname,
         'mode': oct(entry.mode), 'resolved': resolve(entry)}
        for i, entry in enumerate(members) if entry.islnk()
    ]
    regular_bytes = sum(entry.size for entry in members if entry.isfile())
    copied_bytes = sum(item['resolved'].get('size', 0) for item in hardlinks
                       if item['resolved'].get('type') in ('0', '\x00'))
    return {
        'apk': apk.name, 'apkSha256': apk_hash, 'apkBytes': apk.stat().st_size,
        'bundleSha256': bundle_hash, 'bundleBytes': bundle_size,
        'manifestHashMatches': bundle_hash == manifest.get('sha256'),
        'manifestCompressedBytesMatches': bundle_size == manifest.get('compressedBytes'),
        'manifest': manifest, 'tarEntries': len(members),
        'typeCounts': dict(collections.Counter(
            entry.type.decode('ascii', 'replace') for entry in members)),
        'hardlinks': hardlinks,
        'nonOwnerRwxDirs': [{'path': entry.name, 'mode': oct(entry.mode)}
                            for entry in members
                            if entry.isdir() and entry.mode & 0o700 != 0o700],
        'regularBytes': regular_bytes, 'materializedHardlinkBytes': copied_bytes,
        'materializedTotalMatchesManifest':
            regular_bytes + copied_bytes == manifest.get('expandedBytes'),
        'limitations': 'Static read-only inspection; not proof of Android extraction, SELinux behavior, or runtime execution.'
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path)
    args = parser.parse_args()
    result = audit(args.apk)
    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + '\n', encoding='utf-8')
        print(json.dumps({key: result[key] for key in (
            'apkSha256', 'tarEntries', 'typeCounts', 'manifestHashMatches',
            'materializedTotalMatchesManifest')}, ensure_ascii=False))
    else:
        print(encoded)
