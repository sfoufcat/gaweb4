'use client';

import { ComponentConfig } from '@measured/puck';

export interface SpacerProps {
  height: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showDivider: boolean;
  dividerStyle: 'solid' | 'dashed' | 'dotted';
}

export const Spacer = ({
  height = 'md',
  showDivider = false,
  dividerStyle = 'solid',
}: SpacerProps) => {
  const heightClasses = {
    xs: 'h-4',
    sm: 'h-8',
    md: 'h-16',
    lg: 'h-24',
    xl: 'h-32',
    '2xl': 'h-48',
  };

  const dividerStyles = {
    solid: 'border-solid',
    dashed: 'border-dashed',
    dotted: 'border-dotted',
  };

  return (
    <div className={`${heightClasses[height]} flex items-center justify-center px-6`}>
      {showDivider && (
        <div className={`w-full max-w-4xl border-t border-border ${dividerStyles[dividerStyle]}`} />
      )}
    </div>
  );
};

export const SpacerConfig: ComponentConfig<SpacerProps> = {
  label: 'Spacer',
  fields: {
    height: {
      type: 'select',
      label: 'Height',
      options: [
        { label: 'Extra Small (16px)', value: 'xs' },
        { label: 'Small (32px)', value: 'sm' },
        { label: 'Medium (64px)', value: 'md' },
        { label: 'Large (96px)', value: 'lg' },
        { label: 'Extra Large (128px)', value: 'xl' },
        { label: '2X Large (192px)', value: '2xl' },
      ],
    },
    showDivider: {
      type: 'radio',
      label: 'Show Divider Line',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    dividerStyle: {
      type: 'select',
      label: 'Divider Style',
      options: [
        { label: 'Solid', value: 'solid' },
        { label: 'Dashed', value: 'dashed' },
        { label: 'Dotted', value: 'dotted' },
      ],
    },
  },
  defaultProps: {
    height: 'md',
    showDivider: false,
    dividerStyle: 'solid',
  },
  render: Spacer,
};

