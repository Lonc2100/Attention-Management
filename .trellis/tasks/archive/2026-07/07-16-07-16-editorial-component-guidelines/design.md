# Editorial component guideline adoption

## Product Translation

The reference is a marketing system; Attention Management is a dense desktop data product. Preserve its material and editorial character while adapting scale and meaning.

```text
Reference rule                 Product component rule
Mori 16-19px resting rhythm -> Mori-first stack; 16px body, 14px minimum UI
224px viewport hero         -> Finite 40-60px component hero range
Five GSAP disciplines       -> Five fixed Attention Management disciplines
Curly annotation            -> ModuleHeader owns visible { label }
Outlined-only CTA           -> PillButton ghost / gradient-outline primary
Full-width hairline         -> ModuleDivider component
```

## Component Contract

- `ModuleHeader.discipline`: `green | orange | pink | violet | blue`.
- `PillButton.variant`: `ghost | primary`.
- `ModuleDivider`: semantic separator with no page styling hook.
- Pages supply content and discipline meaning; components own rendering and visual rules.

## Font Boundary

The repository and machine do not contain PP Mori. The token stack names PP Mori first, then uses MiSans and Microsoft YaHei UI for Chinese coverage. No font file is copied or bundled. A licensed asset can later replace the fallback without changing component CSS.

## Rollback

Renderer-only and persistence-free. Revert the work commit to restore the previous component presentation.
