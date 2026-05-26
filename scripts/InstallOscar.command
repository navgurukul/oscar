#!/bin/bash

# Remove macOS quarantine so Oscar can open without terminal commands
xattr -rd com.apple.quarantine /Applications/OSCAR.app 2>/dev/null

# Open the app
open /Applications/OSCAR.app
