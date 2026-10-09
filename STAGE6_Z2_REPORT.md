# STAGE Z2 REPORT

## 1. Input
bdecf585993e2ccb0ad31e7b04469b413bc2aa69d26359885e189afd2d3fb576  /home/workdir/attachments/axon-stage6-z0-result.zip

## 2. Pre-change checks
ddcd5d70559b70388827adbe858ce1f24c4a92f4beaa9c319ee5646358239457  /tmp/pristine/axon-stage6/AxonLogo.jsx
ddcd5d70559b70388827adbe858ce1f24c4a92f4beaa9c319ee5646358239457  /tmp/pristine/axon-stage6/src/components/AxonLogo.jsx
49399 /tmp/pristine/axon-stage6/AxonLogo.jsx
b0a98a06934d2d69d18cfca1deace6cf55bb9cab392f993a30bf99062d5db5dd  /tmp/pristine/axon-stage6/src/background/types.ts

## 3. Reference check
exit=0
exit=0
/tmp/pristine/axon-stage6/AxonLogo.jsx
/tmp/pristine/axon-stage6/STAGE6_Z0_REPORT.md
/tmp/pristine/axon-stage6/src/components/AxonBuildScreen.tsx
/tmp/pristine/axon-stage6/src/components/AxonLogo.jsx
/tmp/pristine/axon-stage6/src/components/AxonSourceScreen.tsx
/tmp/pristine/axon-stage6/src/components/AxonToolsScreen.tsx
/tmp/pristine/axon-stage6/src/components/BackgroundProofScreen.tsx
/tmp/pristine/axon-stage6/src/components/DesignTokensModal.tsx
/tmp/pristine/axon-stage6/src/components/InterfaceCaptureScreen.tsx
/tmp/pristine/axon-stage6/src/components/NavigationDrawer.tsx
/tmp/pristine/axon-stage6/src/components/SettingsModal.tsx
/tmp/pristine/axon-stage6/src/components/WelcomeState.tsx
12 /tmp/z2-refs.sorted
exit=0
import AxonLogo from './AxonLogo.jsx';
9
exit=0
/tmp/pristine/axon-stage6/src/components/AxonBuildScreen.tsx
/tmp/pristine/axon-stage6/src/components/AxonSourceScreen.tsx
/tmp/pristine/axon-stage6/src/components/AxonToolsScreen.tsx
/tmp/pristine/axon-stage6/src/components/BackgroundProofScreen.tsx
/tmp/pristine/axon-stage6/src/components/DesignTokensModal.tsx
/tmp/pristine/axon-stage6/src/components/InterfaceCaptureScreen.tsx
/tmp/pristine/axon-stage6/src/components/NavigationDrawer.tsx
/tmp/pristine/axon-stage6/src/components/SettingsModal.tsx
/tmp/pristine/axon-stage6/src/components/WelcomeState.tsx

## 4. Deletion
exit=0

## 5. Scope gate after the deletion, before the report existed
Only in /tmp/pristine/axon-stage6: AxonLogo.jsx
exit=1
ddcd5d70559b70388827adbe858ce1f24c4a92f4beaa9c319ee5646358239457  /tmp/work/axon-stage6/src/components/AxonLogo.jsx

## 6. Item status
Stage Z2: ROOT AxonLogo.jsx DELETED IN THE WORK TREE=YES  src/components/AxonLogo.jsx UNCHANGED (HASH MATCHED)=YES  NO OTHER FILE DIFFERED AT THE STEP 5 GATE=YES

## 7. Still unproven
- No file was compiled, type-checked, tested, built or run.
- The reference check searched every text file in the tree for the exact string AxonLogo; it does not cover other spellings or names built at run time. The import check covered the src folder only.
- Because the root file is gone, the AXON Source file list and the glob that feeds it no longer include it; this follows from the deletion and was not observed in a running app.
- The app was not opened; that the logo looks the same was not observed.
- File permissions, timestamps and symlinks were not compared; only file paths and contents were.
- Stages Z1 and Z3 to Z6 were not touched.

## 8. Package checks
Package checks (zip SHA-256, entry count, node_modules count, archive test, re-extract comparison, final scope gate, final hash) are not in this file, because this file is inside the zip. They appear in the delivery message under PACKAGE CHECKS.
