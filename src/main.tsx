import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSettingsCapability } from './capabilities/registerSettings';
import { registerAxonToolsCapability } from './capabilities/registerAxonTools';
import { registerAxonSourceCapability } from './capabilities/registerAxonSource';
import { registerInterfaceCaptureCapability } from './capabilities/registerInterfaceCapture';
import { registerBackgroundProofCapability } from './capabilities/registerBackgroundProof';
import { registerSettingsInterface } from './interfaces/registerSettings';
import { registerAxonToolsInterface } from './interfaces/registerAxonTools';
import { registerAxonSourceInterface } from './interfaces/registerAxonSource';
import { registerInterfaceCaptureInterface } from './interfaces/registerInterfaceCapture';
import { registerBackgroundProofInterface } from './interfaces/registerBackgroundProof';
import { RootBoundary } from './components/RootBoundary';
import { getCrashLog, installGlobalCrashHandlers } from './crash/crashLog';

// Stage 4A: Settings capability (declarative; not tied to modal open state)
registerSettingsCapability();
// Stage 4B: AXON Tools capability (declarative; not tied to currentScreen)
registerAxonToolsCapability();
// Stage 4C: AXON Source capability (declarative; not tied to currentScreen)
registerAxonSourceCapability();
// Stage 4D: Interface Capture capability — shell only (engine deleted)
registerInterfaceCaptureCapability();
// Stage 6: Background Proof capability
registerBackgroundProofCapability();
// Stage 4A: Settings interface (declarative; not tied to modal open state)
registerSettingsInterface();
// Stage 4B: AXON Tools interface (declarative; not tied to currentScreen)
registerAxonToolsInterface();
// Stage 4C: AXON Source interface (declarative; not tied to currentScreen)
registerAxonSourceInterface();
// Stage 4D: Interface Capture interface — shell only (engine deleted)
registerInterfaceCaptureInterface();
// Stage 6: Background Proof interface
registerBackgroundProofInterface();

// Errors React cannot catch (event handlers, timers, unhandled promises) go to the crash log
installGlobalCrashHandlers(getCrashLog(), window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
);
