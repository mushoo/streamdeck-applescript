//==============================================================================
/**
 @file       MyStreamDeckPlugin.m
 
 @brief      A Stream Deck plugin for running arbitrary Applescript code
 
 @copyright  (c) 2018, Corsair Memory, Inc.
 This source code is licensed under the MIT-style license found in the LICENSE file.
 
 @author     Mike Schapiro (modified from Elgato's Stream Deck Apple Mail plugin)
 
 **/
//==============================================================================

#import "MyStreamDeckPlugin.h"

#import "ESDSDKDefines.h"
#import "ESDConnectionManager.h"
#import "ESDUtilities.h"
#import <AppKit/AppKit.h>


// Refresh the unread count every 60s
#define REFRESH_UNREAD_COUNT_TIME_INTERVAL        60.0

// Size of the images
#define IMAGE_SIZE    144

// MARK: - Utility methods
//
// Utility function to get the fullpath of an resource in the bundle
//
static NSString * GetResourcePath(NSString *inFilename)
{
    NSString *outPath = nil;
    
    if([inFilename length] > 0)
    {
        NSString * bundlePath = [ESDUtilities pluginPath];
        if(bundlePath != nil)
        {
            outPath = [bundlePath stringByAppendingPathComponent:inFilename];
        }
    }
    return outPath;
}

//
// Utility function to create a CGContextRef
//
static CGContextRef CreateBitmapContext(CGSize inSize)
{
    CGFloat bitmapBytesPerRow = inSize.width * 4;
    CGFloat bitmapByteCount = (bitmapBytesPerRow * inSize.height);
    
    void *bitmapData = calloc(bitmapByteCount, 1);
    if(bitmapData == NULL)
    {
        return NULL;
    }
    
    CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
    CGContextRef context = CGBitmapContextCreate(bitmapData, inSize.width, inSize.height, 8, bitmapBytesPerRow, colorSpace, kCGImageAlphaPremultipliedLast);
    if(context == NULL)
    {
        CGColorSpaceRelease(colorSpace);
        free(bitmapData);
        return NULL;
    }
    else
    {
        CGColorSpaceRelease(colorSpace);
        return context;
    }
}

//
// Utility method that takes the path of an image and create a base64 encoded string
//
static NSString * CreateBase64EncodedString(NSString *inImagePath)
{
    NSString *outBase64PNG = nil;
    
    NSImage* image = [[NSImage alloc] initWithContentsOfFile:inImagePath];
    if(image != nil)
    {
        // Find the best CGImageRef
        CGSize iconSize = CGSizeMake(IMAGE_SIZE, IMAGE_SIZE);
        NSRect theRect = NSMakeRect(0, 0, iconSize.width, iconSize.height);
        CGImageRef imageRef = [image CGImageForProposedRect:&theRect context:NULL hints:nil];
        if(imageRef != NULL)
        {
            // Create a CGContext
            CGContextRef context = CreateBitmapContext(iconSize);
            if(context != NULL)
            {
                // Draw the Mail.app icon
                CGContextDrawImage(context, theRect, imageRef);
                
                // Generate the final image
                CGImageRef completeImage = CGBitmapContextCreateImage(context);
                if(completeImage != NULL)
                {
                    // Export the image to PNG
                    CFMutableDataRef pngData = CFDataCreateMutable(kCFAllocatorDefault, 0);
                    if(pngData != NULL)
                    {
                        CGImageDestinationRef destinationRef = CGImageDestinationCreateWithData(pngData, kUTTypePNG, 1, NULL);
                        if (destinationRef != NULL)
                        {
                            CGImageDestinationAddImage(destinationRef, completeImage, nil);
                            if (CGImageDestinationFinalize(destinationRef))
                            {
                                NSString *base64PNG = [(__bridge NSData *)pngData base64EncodedStringWithOptions:NSDataBase64EncodingEndLineWithCarriageReturn];
                                if([base64PNG length] > 0)
                                {
                                    outBase64PNG = [NSString stringWithFormat:@"data:image/png;base64,%@\">", base64PNG];
                                }
                            }
                            
                            CFRelease(destinationRef);
                        }
                        
                        CFRelease(pngData);
                    }
                    
                    CFRelease(completeImage);
                }
                
                CFRelease(context);
            }
        }
    }
    
    return outBase64PNG;
}



// MARK: - MyStreamDeckPlugin

@interface MyStreamDeckPlugin ()

// The list of visible contexts
@property (strong) NSMutableArray *knownContexts;

// The Script icon encoded in base64
@property (strong) NSString *base64ScriptIconString;

// Keep track of all of our possible settings (sorted by context)
@property (strong) NSMutableDictionary * settingsPayload;

@end

@implementation MyStreamDeckPlugin

// MARK: - Setup the instance variables if needed

- (void)setupIfNeeded
{
    // Create the array of known contexts
    if(_knownContexts == nil)
    {
        _knownContexts = [[NSMutableArray alloc] init];
    }
    
    if(_settingsPayload == nil){
        _settingsPayload = [[NSMutableDictionary alloc] init];
    }
    if(_base64ScriptIconString == nil)
    {
        _base64ScriptIconString = CreateBase64EncodedString(GetResourcePath(@"ScriptIcon.png"));
    }
}

// MARK: - Events handler

- (void)keyDownForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID
{
    NSAppleScript* appleScript;     //empty applescript object
    NSDictionary *errors = nil;     //errors
    
    NSDictionary * tempDict = self.settingsPayload[context]; //grab 'our' copy of the settings (for this specific context/button)
    
    if([tempDict[@"scriptType"] isEqualToString:@"file"])
    {
        // Handler for Script Files
        NSString * tempFile = tempDict[@"myScriptFile"];
        NSURL * url = [NSURL fileURLWithPath:tempFile];
        if (tempFile != nil){
            appleScript = [[[NSAppleScript alloc] initWithContentsOfURL:url error:&errors] autorelease];
        }
    }
    else if([tempDict[@"scriptType"] isEqualToString:@"inline"])
    {
        //Handler for inline scripts
        NSString * tempSource= tempDict[@"myScriptSource"];
        if(tempSource != nil){
            appleScript = [[[NSAppleScript alloc] initWithSource:tempSource] autorelease];
        }
    }
    
    // Run it!
    if(appleScript != nil)
    {
        [appleScript executeAndReturnError:&errors];
    }
    else {
        //NSLog(@"KEYDOWN NIL APPLSCRPT %@", @"");
    }

    //NSLog(@"KEYDOWN ERRORS: %@", errors);
    
}

- (void)sendToPlugin:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload
{
//    NSLog(@"FULLSENDTOPLUGIN value: %@", payload);
//    NSLog(@"SENDTOPLUGIN context: %@", context);
//    for(NSString * pSub in payload){
//        NSLog(@"SENDTOPLUGIN pSub: %@", pSub);
//        NSLog(@"SENDTOPLUGIN value: %@", payload[pSub]);
//    }
    
    /* Update the property inspector with stored settings */
    if ([payload[@"property_inspector"] isEqualToString:@"propertyInspectorConnected"])
    {
        // Pull out this context's settings from the not-a-database (see init-if-necessary)
        NSDictionary * tempDict = self.settingsPayload[context];
        NSString * tempFile = tempDict[@"myScriptFile"];
        NSString * tempSource= tempDict[@"myScriptSource"];
        NSDictionary * storedSettingsDict = [[NSDictionary alloc]init];
        
        if(tempFile != nil){
            storedSettingsDict = @{
                                   @"setScriptFile" : tempFile  //setScriptFile is from PI .js
                                   };
            NSLog(@"tempFile value: %@", tempFile);
            [self.connectionManager sendToPropertyInspector:storedSettingsDict withContext:context];    //Send values to PI
        }
         if(tempSource != nil){
            storedSettingsDict = @{
                                   @"setInlineScript" : tempSource  //setInlineScript is from PI .js
                                   };
             [self.connectionManager sendToPropertyInspector:storedSettingsDict withContext:context];   //Send values to PI
        }
    }
    else {
        //NSLog(@"boo not a PIC: %@", payload[@"property_inspector"]);
    }
    
    
    /* Update settings when changed in the PropertyInspector */
    NSDictionary * newSettings;
    NSDictionary * payloadFromPI = payload[@"sdpi_collection"];
    
    //store inline scripts
    if ([payloadFromPI[@"key"] isEqualToString:@"appleScriptInline"])
    {
        NSAppleScript * appleScript = [[NSAppleScript alloc] initWithSource:payloadFromPI[@"value"]];
        newSettings = @{
                        @"myScriptSource": appleScript.source,
                        @"scriptType" : @"inline"
                        };
    }
    //store file path to a script
    else if ([payloadFromPI[@"key"] isEqualToString:@"elgfilepicker"])
    {
        NSDictionary *errors = nil;
        NSString * myFile = payloadFromPI[@"value"];
        NSAppleScript* appleScript1;
        NSAppleScript* appleScript2;
        
        appleScript1 = [[NSAppleScript alloc] initWithContentsOfURL:[NSURL fileURLWithPath:myFile] error:&errors];
        appleScript2 = [[NSAppleScript alloc] initWithSource:appleScript1.source]; // don't ask me why this has to be this way, but this way it DOES seem to WORK
        
        newSettings = @{
                        @"myScriptFile": myFile,
                        @"myScriptSource": appleScript2.source,
                        @"scriptType" : @"file"
                        };
    }

    [self.connectionManager setSettings:newSettings forContext:context];    //tell SD to store settings

    NSDictionary * newContext = @{context : newSettings};           //Update our internal not-a-database
    [self.settingsPayload addEntriesFromDictionary:newContext];
}

- (void)keyUpForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID
{
    // Nothing to do
}

- (void)willAppearForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID
{
    // Set up the instance variables if needed
    [self setupIfNeeded];
    
    NSLog(@"willAppear: %@", payload);
    
    //create a temp dictionary with the "context" for this 'fake instance' with contents of settings from App
    NSDictionary * tempSettings = @{context: payload[@"settings"]};
    
    //add that temp dictionary to our internal not-a-database
    [self.settingsPayload addEntriesFromDictionary:tempSettings];
    
    //NSLog(@"settingsPayload: %@", self.settingsPayload);
    
    // Add the context to the list of known contexts
    [self.knownContexts addObject:context];
}

- (void)willDisappearForAction:(NSString *)action withContext:(id)context withPayload:(NSDictionary *)payload forDevice:(NSString *)deviceID
{
    // Remove the context from the list of known contexts
    [self.knownContexts removeObject:context];
}

- (void)deviceDidConnect:(NSString *)deviceID withDeviceInfo:(NSDictionary *)deviceInfo
{
    // Nothing to do
}

- (void)deviceDidDisconnect:(NSString *)deviceID
{
    // Nothing to do
}

- (void)applicationDidLaunch:(NSDictionary *)applicationInfo
{
        // Nothing to do
}

- (void)applicationDidTerminate:(NSDictionary *)applicationInfo
{
    // Nothing to do
}

@end
