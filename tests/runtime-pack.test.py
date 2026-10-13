import importlib.util
import os
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('runtime_builder', Path(__file__).resolve().parents[1] / 'scripts/build-runtime.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class RuntimePackTest(unittest.TestCase):
    def guest(self, directory):
        guest = Path(directory) / 'guest'
        (guest / 'opt/node/bin').mkdir(parents=True)
        (guest / 'opt/hds').mkdir(parents=True)
        (guest / 'opt/node/bin/node').write_bytes(b'node')
        (guest / 'opt/hds/host.cjs').write_bytes(b'host')
        return guest

    def test_materializes_shared_inodes_and_counts_once_per_path(self):
        with tempfile.TemporaryDirectory() as directory:
            guest = self.guest(directory)
            original = guest / 'opt/node/bin/node'
            os.chmod(original, 0o755)
            os.link(original, guest / 'opt/node/bin/alias')
            archive = Path(directory) / 'guest.gz'
            audit = builder.pack_guest(guest, archive)
            self.assertEqual(audit['hardlinks'], 0)
            self.assertEqual(audit['expandedBytes'], 12)
            with tarfile.open(archive) as source:
                alias = source.getmember('./opt/node/bin/alias')
                self.assertTrue(alias.isfile())
                self.assertEqual(source.extractfile(alias).read(), b'node')
                if os.name == 'posix': self.assertEqual(alias.mode, 0o755)

    @unittest.skipUnless(os.name == 'posix', 'Symlink creation requires Linux CI')
    def test_preserves_symlink_instead_of_dereferencing(self):
        with tempfile.TemporaryDirectory() as directory:
            guest = self.guest(directory)
            (guest / 'opt/node/bin/ref').symlink_to('node')
            archive = Path(directory) / 'guest.gz'
            audit = builder.pack_guest(guest, archive)
            self.assertEqual(audit['symlinks'], 1)
            self.assertEqual(audit['expandedBytes'], 8)
            with tarfile.open(archive) as source:
                entry = source.getmember('./opt/node/bin/ref')
                self.assertTrue(entry.issym())
                self.assertEqual(entry.linkname, 'node')

    @unittest.skipUnless(os.name == 'posix', 'Symlink creation requires Linux CI')
    def test_rejects_symlink_escape(self):
        with tempfile.TemporaryDirectory() as directory:
            guest = self.guest(directory)
            (guest / 'escape').symlink_to('../../outside')
            with self.assertRaisesRegex(RuntimeError, 'escapes root'):
                builder.pack_guest(guest, Path(directory) / 'guest.gz')

if __name__ == '__main__': unittest.main()
