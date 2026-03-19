#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NitroUpdateCrashHandler : NSObject

+ (void)performRollbackWithReason:(NSString *)reason;

@end

NS_ASSUME_NONNULL_END
