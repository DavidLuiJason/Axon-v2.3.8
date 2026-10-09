/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AXON Design System Tokens
 * Centralized dimensions, geometry, and styling tokens matching the official reference designs.
 */

export const AXON_TOKENS = {
  // Brand colors
  colors: {
    canvas: '#121315',
    canvasElevated: '#17181A',
    surfaceDrawer: '#141517',
    surfaceComposer: '#1F2023',
    surfacePill: '#25262A',
    surfaceActive: '#26272B',
    surfaceCard: '#1E1F22',
    accentCoral: '#E85A3C',
    accentCoralHover: '#F0684B',
    textPrimary: '#EDEDED',
    textSecondary: '#9A9B9F',
    textMuted: '#68696E',
    borderSubtle: 'rgba(255, 255, 255, 0.07)',
    userBubble: '#242529',
  },

  // Persistent Top Bar
  topBar: {
    height: '64px',
    paddingX: '16px',
    buttonSize: '40px', // Menu button and three-dot button
    buttonHitArea: '44px',
    axonSelectorHeight: '36px',
    axonSelectorPaddingX: '14px',
    axonSelectorGap: '6px',
    iconSize: 20,
  },

  // Persistent Bottom Composer
  composer: {
    maxWidth: '720px',
    outerMarginBottom: '16px',
    paddingHorizontal: '14px',
    paddingVertical: '12px',
    borderRadius: '26px', // Rounded pill-like container
    plusButtonSize: '36px',
    plusIconSize: 18,
    modelSelectorHeight: '32px',
    modelSelectorPaddingX: '12px',
    microphoneButtonSize: '36px',
    microphoneIconSize: 20,
    voiceSendButtonSize: '40px', // Persistent circular action button
    indicatorOffsetBottom: '8px', // Indicator above composer
  },

  // Indicator above composer
  indicator: {
    width: '28px',
    height: '18px',
    borderRadius: '5px',
  },

  // Navigation Drawer
  drawer: {
    width: '320px',
    headerPadding: '20px 20px 16px 20px',
    itemHeight: '44px',
    itemGap: '2px',
    iconSize: 20,
    searchButtonSize: '36px',
    bottomBarPadding: '16px 20px',
  },

  // Message area
  messages: {
    maxWidth: '720px',
    bubblePadding: '14px 18px',
    userBubbleRadius: '22px',
    userBubbleRadiusCorner: '6px', // top-right sharper corner
    axonSpacingY: '14px',
    actionButtonSize: '32px',
    sourcesPillHeight: '28px',
  },

  // Typography
  typography: {
    fontSerif: '"Cormorant Garamond", Georgia, serif',
    fontSans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    welcomeSize: '28px',
  },
} as const;
