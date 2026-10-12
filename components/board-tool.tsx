import type { ComponentProps } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
export function BoardTool({
  label,
  help,
  children,
  ...props
}: ComponentProps<'button'> & { label: string; help?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button {...props} aria-label={label} aria-description={help}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        sideOffset={9}
        collisionPadding={8}
        className="board-tool-tooltip"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
