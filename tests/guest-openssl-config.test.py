"""Validate the guest OpenSSL configuration materialized by build-runtime.py.

Full guest construction requires network downloads, so this test only pins the
exact configuration bytes the runtime builder must ship and checks they parse
with the local OpenSSL command when available. Mirrors the crash fixed in
0.1.0-preview.3: Node inside PRoot died with
"BIO_new_file:Function not implemented" reading /etc/ssl/openssl.cnf because
ubuntu-base never ships that file.
"""
import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('runtime_builder', Path(__file__).resolve().parents[1] / 'scripts/build-runtime.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

EXPECTED_SHA256 = '66ee62250c859fd8c8692b3d8d86efdd59b87287ff989b3ee773c6c5500b166e'


def guest_openssl_config():
    """Recreate the exact bytes build-runtime.py writes to /etc/ssl/openssl.cnf."""
    return (
        '# Minimal OpenSSL configuration for the HDS Android guest.\n'
        '# Node only needs a syntactically valid file; defaults apply for everything else.\n'
        'openssl_conf = openssl_init\n\n'
        '[openssl_init]\n'
        'providers = provider_sect\n\n'
        '[provider_sect]\n'
        'default = default_sect\n\n'
        '[default_sect]\n'
        'activate = 1\n')


class GuestOpensslConfigTest(unittest.TestCase):
    def test_builder_writes_expected_config(self):
        """Keep the builder source and this pin in lockstep."""
        source = Path(builder.__file__).read_text()
        self.assertIn("openssl_conf = openssl_init", source)
        self.assertIn("activate = 1", source)
        self.assertIn("'etc/ssl/openssl.cnf'", source)

    def test_config_bytes_are_pinned(self):
        content = guest_openssl_config().encode()
        digest = hashlib.sha256(content).hexdigest()
        self.assertEqual(digest, EXPECTED_SHA256, 'Guest openssl.cnf content drifted; update builder and this pin together')

    @unittest.skipUnless(shutil.which('openssl'), 'openssl CLI not available')
    def test_config_is_valid_openssl_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'openssl.cnf'
            config.write_text(guest_openssl_config())
            env = dict(os.environ, OPENSSL_CONF=str(config))
            probe = subprocess.run(['openssl', 'version'], capture_output=True, text=True, env=env, check=False)
            self.assertEqual(probe.returncode, 0, probe.stderr)
            providers = subprocess.run(['openssl', 'list', '-providers'], capture_output=True, text=True, env=env, check=False)
            self.assertEqual(providers.returncode, 0, providers.stderr)
            self.assertIn('default', providers.stdout)

    def test_config_survives_guest_packing(self):
        with tempfile.TemporaryDirectory() as directory:
            guest = Path(directory) / 'guest'
            (guest / 'etc/ssl').mkdir(parents=True)
            (guest / 'opt/node/bin').mkdir(parents=True)
            (guest / 'opt/hds').mkdir(parents=True)
            (guest / 'etc/ssl/openssl.cnf').write_bytes(guest_openssl_config().encode())
            (guest / 'opt/node/bin/node').write_bytes(b'node')
            (guest / 'opt/hds/host.cjs').write_bytes(b'host')
            (guest / 'opt/hds/model-probe.cjs').write_bytes(b'probe')
            audit = builder.pack_guest(guest, Path(directory) / 'guest.gz')
            with tarfile.open(Path(directory) / 'guest.gz') as source:
                entry = source.getmember('./etc/ssl/openssl.cnf')
                self.assertTrue(entry.isfile())
                self.assertEqual(source.extractfile(entry).read(), guest_openssl_config().encode())
            self.assertGreater(audit['expandedBytes'], 0)


if __name__ == '__main__': unittest.main()
