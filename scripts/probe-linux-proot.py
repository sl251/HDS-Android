"""Exercise the packaged Node under Linux PRoot, not just chroot.

This does not emulate Android's inherited seccomp/SELinux policy.
"""
import os
from pathlib import Path
import signal
import subprocess

root = Path(__file__).resolve().parents[1] / 'runtime/generated/rootfs'
for name in ('hds-data', 'qq-data'):
    (root / name).mkdir(exist_ok=True)
command = ['proot', '--kill-on-exit', '-0', '-r', str(root), '-b', '/dev', '-b', '/proc', '-b', '/sys', '-w', '/opt/hds', '/opt/node/bin/node', '/opt/hds/guest-probe.cjs']
passed = 0
for disabled in (True, False):
    env = dict(os.environ, HOME='/root', HDS_MOBILE_MAIN='0', OPENSSL_CONF='/etc/ssl/openssl.cnf', LD_LIBRARY_PATH='')
    for name in ('PROOT_LOADER', 'PROOT_TMP_DIR', 'TMPDIR', 'PROOT_NO_SECCOMP'):
        env.pop(name, None)
    if disabled:
        env['PROOT_NO_SECCOMP'] = '1'
    child = subprocess.Popen(command, cwd=root.parent, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    timed_out = False
    try:
        output, _ = child.communicate(timeout=35)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(child.pid, signal.SIGKILL)
        output, _ = child.communicate()
    success = not timed_out and child.returncode == 0 and 'HDS_GUEST_PROBE_OK' in output.splitlines()
    print(f'Linux PRoot probe disableSeccomp={disabled}: {"PASS" if success else "FAIL"}; exit={child.returncode}; timeout={timed_out}', flush=True)
    print(output[-4096:], flush=True)
    passed += success
if not passed:
    raise SystemExit('No Linux PRoot profile passed actual guest syscalls')
