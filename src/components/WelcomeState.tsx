/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AxonLogo from './AxonLogo.jsx';
import { useUserName } from '../state/AxonStateContext';

export const WelcomeState: React.FC = () => {
  // Stage 1C-iv: userName via state root
  const { userName } = useUserName();

  return (
    <div className="flex-1 flex flex-col items-center justify-center pt-14 pb-36 px-6 select-none animate-in fade-in duration-300">
      {/* Unit anchored with the Welcome headline at the true vertical center */}
      <div className="relative flex flex-col items-center">
        {/* Central AXON Tree Logo positioned directly above the text (-40% scaled: 50px) */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[7px] flex items-center justify-center pointer-events-none">
          <AxonLogo className="w-[50px] h-[50px]" />
        </div>

        {/* Welcome Headline positioned at the true vertical center */}
        <h1 className="font-serif text-[32px] sm:text-[36px] font-normal text-[#EAEAEA] tracking-normal text-center leading-tight">
          Welcome, {userName}
        </h1>
      </div>

      {/* Intentional calm empty space preserved - anti-clutter discipline */}
    </div>
  );
};
