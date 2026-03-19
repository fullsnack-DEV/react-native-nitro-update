#import "NitroUpdateBundleManagerObjC.h"

static NSString *const kBundlePathKey = @"nitroupdate.bundlePath";
static NSString *const kVersionKey = @"nitroupdate.version";
static NSString *const kPendingValidationKey = @"nitroupdate.pendingValidation";
static NSString *const kPreviousBundlePathKey = @"nitroupdate.previousBundlePath";
static NSString *const kPreviousVersionKey = @"nitroupdate.previousVersion";
static NSString *const kLaunchAttemptsKey = @"nitroupdate.launchAttempts";

@implementation NitroUpdateBundleManagerObjC

+ (void)recoverIfPendingBundleLikelyCrashed {
  NSUserDefaults *defaults = [NSUserDefaults standardUserDefaults];
  BOOL pending = [defaults boolForKey:kPendingValidationKey];
  NSInteger attempts = [defaults integerForKey:kLaunchAttemptsKey];

  if (!pending) {
    if (attempts != 0) {
      [defaults setInteger:0 forKey:kLaunchAttemptsKey];
    }
    return;
  }

  attempts += 1;
  [defaults setInteger:attempts forKey:kLaunchAttemptsKey];

  if (attempts < 2) {
    return;
  }

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
}

+ (NSURL *)getStoredBundleURL {
  [self recoverIfPendingBundleLikelyCrashed];

  NSString *path = [[NSUserDefaults standardUserDefaults] stringForKey:kBundlePathKey];
  if (path.length == 0 || ![[NSFileManager defaultManager] fileExistsAtPath:path]) {
    return nil;
  }

  return [NSURL fileURLWithPath:path];
}

@end
