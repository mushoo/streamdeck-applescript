# streamdeck-applescript
A Stream Deck plugin for running arbitrary Applescript code

Run any Applescript from your Elgato Stream Deck - allows for either .scpt files or inline applescript code. Note that currently the UI isn't updated to show if a file is being used as the reference, not sure why... Otherwise it should work nicely!

Please note, this does seem to run fine in Streamdeck v4.3.0 (11246) but it is NOT using v2 of the SDK - which means you must use an older version of the DistributionTool if you want to package it up as a .sdPlugin file, or it'll act very weird!

The .sdPlugin in Releases should work fine, though.
