#import "NitroUpdateCrashHandler.h"

#import <Foundation/Foundation.h>
#import <signal.h>

static NSString *const kBundlePathKey = @"nitroupdate.bundlePath";
static NSString *const kVersionKey = @"nitroupdate.version";
static NSString *const kPendingValidationKey = @"nitroupdate.pendingValidation";
static NSString *const kPreviousBundlePathKey = @"nitroupdate.previousBundlePath";
static NSString *const kPreviousVersionKey = @"nitroupdate.previousVersion";
static NSString *const kLaunchAttemptsKey = @"nitroupdate.launchAttempts";

static BOOL gNitroUpdatePendingValidation = NO;
static NSUncaughtExceptionHandler *gNitroUpdatePreviousExceptionHandler = NULL;

static void NitroUpdateApplyRollback(const char *reason) {
  if (!gNitroUpdatePendingValidation) {
    return;
  }

  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];

  NSString *prevPath = [defaults stringForKey:kPreviousBundlePathKey];
  NSString *prevVersion = [defaults stringForKey:kPreviousVersionKey];

  BOOL hasValidPrevious = prevPath.length > 0 && [[NSFileManager defaultManager] fileExistsAtPath:prevPath];

  if (hasValidPrevious) {
    [defaults setObject:prevPath forKey:kBundlePathKey];
    if (prevVersion.length > 0) {
      [defaults setObject:prevVersion forKey:kVersionKey];
    } else {
      [defaults removeObjectForKey:kVersionKey];
    }
  } else {
    [defaults removeObjectForKey:kBundlePathKey];
    [defaults removeObjectForKey:kVersionKey];
  }

  [defaults setBool:NO forKey:kPendingValidationKey];
  [defaults removeObjectForKey:kPreviousBundlePathKey];
  [defaults removeObjectForKey:kPreviousVersionKey];
  [defaults setInteger:0 forKey:kLaunchAttemptsKey];
  [defaults synchronize];

  (void)reason;
  gNitroUpdatePendingValidation = NO;
}

static void NitroUpdateSignalHandler(int sig) {
  NitroUpdateApplyRollback("crash_detected");

  signal(sig, SIG_DFL);
  raise(sig);
}

static void NitroUpdateInstallSignalHandlers(void) {
  signal(SIGABRT, NitroUpdateSignalHandler);
  signal(SIGILL, NitroUpdateSignalHandler);
  signal(SIGSEGV, NitroUpdateSignalHandler);
  signal(SIGFPE, NitroUpdateSignalHandler);
  signal(SIGBUS, NitroUpdateSignalHandler);
  signal(SIGPIPE, NitroUpdateSignalHandler);
}

static void NitroUpdateExceptionHandler(NSException *exception) {
  NitroUpdateApplyRollback("crash_detected");

  if (gNitroUpdatePreviousExceptionHandler != NULL) {
    gNitroUpdatePreviousExceptionHandler(exception);
  }
}

@implementation NitroUpdateCrashHandler

+ (void)load {
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  gNitroUpdatePendingValidation = [defaults boolForKey:kPendingValidationKey];

  if (!gNitroUpdatePendingValidation) {
    return;
  }

  NitroUpdateInstallSignalHandlers();
  gNitroUpdatePreviousExceptionHandler = NSGetUncaughtExceptionHandler();
  NSSetUncaughtExceptionHandler(NitroUpdateExceptionHandler);
}

+ (void)performRollbackWithReason:(NSString *)reason {
  NitroUpdateApplyRollback([reason UTF8String]);
}

@end
