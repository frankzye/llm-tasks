"use client";

/**
 * assistant-ui ModelSelector pattern: registers `config.modelName` via
 * `runtime.registerModelContextProvider` (see assistant-ui docs / shadcn example).
 * @see https://github.com/assistant-ui/assistant-ui/blob/main/packages/ui/src/components/assistant-ui/model-selector.tsx
 */

import { useAui } from "@assistant-ui/react";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

export type ModelOption = {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type ModelSelectorContextValue = {
  models: ModelOption[];
  value: string | undefined;
};

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

function useModelSelectorContext() {
  const ctx = useContext(ModelSelectorContext);
  if (!ctx) {
    throw new Error(
      "ModelSelector sub-components must be used within ModelSelector.Root",
    );
  }
  return ctx;
}

export type ModelSelectorRootProps = {
  models: ModelOption[];
  value?: string;
  children: ReactNode;
};

function ModelSelectorRoot({ models, value, children }: ModelSelectorRootProps) {
  return (
    <ModelSelectorContext.Provider value={{ models, value }}>
      {children}
    </ModelSelectorContext.Provider>
  );
}

function cn(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

const triggerBase =
  "aui-model-selector-trigger min-w-[10rem] max-w-[14rem] cursor-pointer rounded-md px-3 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#1a73e8] dark:focus-visible:ring-[var(--accent)]";

const triggerVariants = {
  outline:
    "border border-[#dadce0] bg-white text-[#1f1f1f] hover:bg-[#f1f3f4] dark:border-[var(--border)] dark:bg-[var(--surface)] dark:text-[var(--text)] dark:hover:bg-white/[0.04]",
  ghost:
    "bg-transparent text-[#1f1f1f] hover:bg-black/[0.04] dark:text-[var(--text)] dark:hover:bg-white/[0.04]",
} as const;

export type ModelSelectorTriggerProps = Omit<
  ComponentPropsWithoutRef<"select">,
  "size"
> & {
  variant?: keyof typeof triggerVariants;
};

function ModelSelectorTrigger({
  className,
  variant = "outline",
  children,
  ...props
}: ModelSelectorTriggerProps) {
  const { models } = useModelSelectorContext();
  return (
    <select
      data-slot="model-selector-trigger"
      className={cn(triggerBase, triggerVariants[variant], className)}
      {...props}
    >
      {children ??
        models.map((m) => (
          <option
            key={m.id}
            value={m.id}
            disabled={m.disabled}
            title={m.description}
          >
            {m.name}
          </option>
        ))}
    </select>
  );
}

export type ModelSelectorProps = {
  models: ModelOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  variant?: keyof typeof triggerVariants;
  contentClassName?: string;
  className?: string;
};

const ModelSelectorImpl = ({
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  models,
  variant = "outline",
  className,
  contentClassName: _contentClassName,
  ...rest
}: ModelSelectorProps) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? models[0]?.id ?? "",
  );

  const value = isControlled ? controlledValue : internalValue;
  const onValueChange = controlledOnValueChange ?? setInternalValue;

  const aui = useAui();

  useEffect(() => {
    const config = { config: { modelName: value } };
    return aui.modelContext().register({
      getModelContext: () => config,
    });
  }, [aui, value]);

  return (
    <ModelSelectorRoot models={models} value={value}>
      <ModelSelectorTrigger
        variant={variant}
        className={className}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        {...rest}
      />
    </ModelSelectorRoot>
  );
};

type ModelSelectorComponent = typeof ModelSelectorImpl & {
  displayName?: string;
  Root: typeof ModelSelectorRoot;
  Trigger: typeof ModelSelectorTrigger;
};

const ModelSelector = memo(ModelSelectorImpl) as unknown as ModelSelectorComponent;

ModelSelector.displayName = "ModelSelector";
ModelSelector.Root = ModelSelectorRoot;
ModelSelector.Trigger = ModelSelectorTrigger;

export { ModelSelector };
