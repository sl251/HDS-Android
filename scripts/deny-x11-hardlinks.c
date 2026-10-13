/* CI-only fault injection, scoped to the Xvfb child. Not shipped in the APK.
 * Reproduce Android's link permission failure without changing file modes. */
#include <errno.h>

int link(const char *oldpath, const char *newpath) {
    errno = EACCES;
    return -1;
}

int linkat(int olddirfd, const char *oldpath, int newdirfd, const char *newpath, int flags) {
    errno = EACCES;
    return -1;
}
