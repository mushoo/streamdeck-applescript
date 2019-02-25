//==============================================================================
/**
@file       MyStreamDeckPlugin.h

@brief      A Stream Deck plugin for running arbitrary Applescript code

@copyright  (c) 2018, Corsair Memory, Inc.
			This source code is licensed under the MIT-style license found in the LICENSE file.
 
@author     Mike Schapiro (modified from Elgato's Stream Deck Apple Mail plugin)
 
**/
//==============================================================================

#import <Foundation/Foundation.h>
#import "ESDEventsProtocol.h"

@class ESDConnectionManager;


NS_ASSUME_NONNULL_BEGIN

@interface MyStreamDeckPlugin : NSObject <ESDEventsProtocol>

@property (weak) ESDConnectionManager *connectionManager;

- (void)keyDownForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID;

- (void)sendToPlugin:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload;

- (void)keyUpForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID;
- (void)willAppearForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID;
- (void)willDisappearForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID;

- (void)deviceDidConnect:(NSString *)deviceID withDeviceInfo:(NSDictionary *)deviceInfo;
- (void)deviceDidDisconnect:(NSString *)deviceID;

- (void)applicationDidLaunch:(NSDictionary *)applicationInfo;
- (void)applicationDidTerminate:(NSDictionary *)applicationInfo;

@end

NS_ASSUME_NONNULL_END

