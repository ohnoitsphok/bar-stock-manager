#!/usr/bin/env python3
"""
Standalone Zero-Dependency Tailwind CSS Builder for Bar Stock Manager.
Scans index.html and js/**/*.js and generates css/tailwind.css.
Usage: python scripts/build_css.py
"""
import os
import re
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

COLORS = {
    'black': '#000000',
    'white': '#ffffff',
    'darkbg': '#0a0c10',
    'cardbg': '#12151c',
    'cardhover': '#171c26',
    'bordercol': '#222836',
    'borderlight': '#2c3446',
    'accent': '#f59e0b',
    'gray-100': '#f3f4f6',
    'gray-200': '#e5e7eb',
    'gray-300': '#d1d5db',
    'gray-400': '#9ca3af',
    'gray-500': '#6b7280',
    'gray-700': '#374151',
    'gray-800': '#1f2937',
    'slate-200': '#e2e8f0',
    'slate-700': '#334155',
    'slate-900': '#0f172a',
    'slate-950': '#020617',
    'amber-200': '#fde68a',
    'amber-300': '#fcd34d',
    'amber-400': '#fbbf24',
    'amber-500': '#f59e0b',
    'amber-600': '#d97706',
    'amber-950': '#451a03',
    'emerald-200': '#a7f3d0',
    'emerald-300': '#6ee7b7',
    'emerald-400': '#34d399',
    'emerald-500': '#10b981',
    'emerald-600': '#059669',
    'emerald-900': '#064e3b',
    'emerald-950': '#022c22',
    'red-200': '#fecaca',
    'red-300': '#fca5a5',
    'red-400': '#f87171',
    'red-500': '#ef4444',
    'red-900': '#7f1d1d',
    'red-950': '#450a0a',
    'blue-400': '#60a5fa',
    'blue-500': '#3b82f6',
    'blue-600': '#2563eb',
}

SPACING = {
    '0': '0px',
    '0.2': '0.05rem',
    '0.5': '0.125rem',
    '1': '0.25rem',
    '1.5': '0.375rem',
    '2': '0.5rem',
    '2.5': '0.625rem',
    '3': '0.75rem',
    '3.5': '0.875rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '7': '1.75rem',
    '8': '2rem',
    '9': '2.25rem',
    '10': '2.5rem',
    '12': '3rem',
    '14': '3.5rem',
    '16': '4rem',
    '28': '7rem',
    '36': '9rem',
    '44': '11rem',
    '48': '12rem',
    '60': '15rem',
    '64': '16rem',
}

BREAKPOINTS = {
    'xs': '420px',
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
}

def hex_to_rgba(hex_str, alpha):
    h = hex_str.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"rgba({r}, {g}, {b}, {alpha})"

def resolve_color(val):
    if '/' in val:
        base, op = val.split('/', 1)
        if base not in COLORS:
            return None
        if op.startswith('[') and op.endswith(']'):
            alpha = float(op[1:-1])
        else:
            alpha = int(op) / 100.0
        return hex_to_rgba(COLORS[base], alpha)
    return COLORS.get(val)

def escape_selector(cls):
    return re.sub(r'([^a-zA-Z0-9_-])', r'\\\1', cls)

def compile_base_utility(base):
    # Arbitrary size/value helpers
    if base.startswith('bg-'):
        c = resolve_color(base[3:])
        if c: return f"background-color: {c};"
    if base.startswith('text-'):
        rest = base[5:]
        c = resolve_color(rest)
        if c: return f"color: {c};"
        sizes = {
            'xs': ('0.75rem', '1rem'),
            'sm': ('0.875rem', '1.25rem'),
            'base': ('1rem', '1.5rem'),
            'lg': ('1.125rem', '1.75rem'),
            'xl': ('1.25rem', '1.75rem'),
            '2xl': ('1.5rem', '2rem'),
        }
        if rest in sizes:
            fs, lh = sizes[rest]
            return f"font-size: {fs}; line-height: {lh};"
        if rest.startswith('[') and rest.endswith(']'):
            return f"font-size: {rest[1:-1]};"
        if rest in ('left', 'center', 'right'):
            return f"text-align: {rest};"
    if base == 'border':
        return "border-width: 1px;"
    if base == 'border-b':
        return "border-bottom-width: 1px;"
    if base == 'border-t':
        return "border-top-width: 1px;"
    if base == 'border-collapse':
        return "border-collapse: collapse;"
    if base.startswith('border-'):
        c = resolve_color(base[7:])
        if c: return f"border-color: {c};"
    if base == 'divide-y':
        return ("CHILD:> :not([hidden]) ~ :not([hidden])", "border-top-width: 1px;")
    if base.startswith('divide-'):
        c = resolve_color(base[7:])
        if c: return ("CHILD:> :not([hidden]) ~ :not([hidden])", f"border-color: {c};")
    if base.startswith('space-x-'):
        sp = SPACING.get(base[8:])
        if sp: return ("CHILD:> :not([hidden]) ~ :not([hidden])", f"margin-left: {sp};")
    if base.startswith('space-y-'):
        sp = SPACING.get(base[8:])
        if sp: return ("CHILD:> :not([hidden]) ~ :not([hidden])", f"margin-top: {sp};")

    # Padding & Margin
    for prefix, prop in [
        ('p-', ('padding',)),
        ('px-', ('padding-left', 'padding-right')),
        ('py-', ('padding-top', 'padding-bottom')),
        ('pt-', ('padding-top',)),
        ('pb-', ('padding-bottom',)),
        ('pl-', ('padding-left',)),
        ('pr-', ('padding-right',)),
        ('m-', ('margin',)),
        ('mx-', ('margin-left', 'margin-right')),
        ('my-', ('margin-top', 'margin-bottom')),
        ('mt-', ('margin-top',)),
        ('mb-', ('margin-bottom',)),
        ('ml-', ('margin-left',)),
        ('mr-', ('margin-right',)),
    ]:
        if base.startswith(prefix):
            val = base[len(prefix):]
            sp = 'auto' if val == 'auto' else SPACING.get(val)
            if sp:
                return ' '.join(f"{p}: {sp};" for p in prop)

    # Width / Height / Min / Max
    if base == 'w-full': return "width: 100%;"
    if base == 'w-auto': return "width: auto;"
    if base.startswith('w-') and base[2:] in SPACING:
        return f"width: {SPACING[base[2:]]};"
    if base.startswith('h-') and base[2:] in SPACING:
        return f"height: {SPACING[base[2:]]};"
    if base == 'min-h-screen': return "min-height: 100vh;"
    if base.startswith('min-w-[') and base.endswith(']'):
        return f"min-width: {base[7:-1]};"
    if base.startswith('min-h-[') and base.endswith(']'):
        return f"min-height: {base[7:-1]};"
    if base.startswith('max-h-[') and base.endswith(']'):
        return f"max-height: {base[7:-1]};"
    if base.startswith('max-h-') and base[6:] in SPACING:
        return f"max-height: {SPACING[base[6:]]};"
    max_w_map = {
        'max-w-xs': '20rem',
        'max-w-sm': '24rem',
        'max-w-2xl': '42rem',
        'max-w-4xl': '56rem',
        'max-w-7xl': '80rem',
    }
    if base in max_w_map:
        return f"max-width: {max_w_map[base]};"
    if base.startswith('max-w-[') and base.endswith(']'):
        return f"max-width: {base[7:-1]};"

    # Display / Flex / Grid / Position
    static_map = {
        'block': 'display: block;',
        'inline': 'display: inline;',
        'flex': 'display: flex;',
        'grid': 'display: grid;',
        'table-cell': 'display: table-cell;',
        'hidden': 'display: none;',
        'flex-1': 'flex: 1 1 0%;',
        'flex-initial': 'flex: 0 1 auto;',
        'flex-col': 'flex-direction: column;',
        'flex-row': 'flex-direction: row;',
        'flex-wrap': 'flex-wrap: wrap;',
        'shrink-0': 'flex-shrink: 0;',
        'items-center': 'align-items: center;',
        'items-start': 'align-items: flex-start;',
        'items-stretch': 'align-items: stretch;',
        'justify-between': 'justify-content: space-between;',
        'justify-center': 'justify-content: center;',
        'justify-end': 'justify-content: flex-end;',
        'justify-start': 'justify-content: flex-start;',
        'self-start': 'align-self: flex-start;',
        'self-end': 'align-self: flex-end;',
        'self-auto': 'align-self: auto;',
        'grid-cols-1': 'grid-template-columns: repeat(1, minmax(0, 1fr));',
        'grid-cols-2': 'grid-template-columns: repeat(2, minmax(0, 1fr));',
        'grid-cols-3': 'grid-template-columns: repeat(3, minmax(0, 1fr));',
        'grid-cols-4': 'grid-template-columns: repeat(4, minmax(0, 1fr));',
        'col-span-1': 'grid-column: span 1 / span 1;',
        'col-span-2': 'grid-column: span 2 / span 2;',
        'col-span-3': 'grid-column: span 3 / span 3;',
        'relative': 'position: relative;',
        'absolute': 'position: absolute;',
        'fixed': 'position: fixed;',
        'sticky': 'position: sticky;',
        'inset-0': 'top: 0px; right: 0px; bottom: 0px; left: 0px;',
        'top-0': 'top: 0px;',
        'top-3': 'top: 0.75rem;',
        'bottom-4': 'bottom: 1rem;',
        'right-0': 'right: 0px;',
        'right-4': 'right: 1rem;',
        'left-2.5': 'left: 0.625rem;',
        'z-10': 'z-index: 10;',
        'z-30': 'z-index: 30;',
        'z-40': 'z-index: 40;',
        'z-50': 'z-index: 50;',
        'overflow-hidden': 'overflow: hidden;',
        'overflow-x-auto': 'overflow-x: auto;',
        'overflow-y-auto': 'overflow-y: auto;',
        'font-sans': 'font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
        'font-mono': 'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;',
        'font-medium': 'font-weight: 500;',
        'font-semibold': 'font-weight: 600;',
        'font-bold': 'font-weight: 700;',
        'uppercase': 'text-transform: uppercase;',
        'tracking-tight': 'letter-spacing: -0.025em;',
        'tracking-wider': 'letter-spacing: 0.05em;',
        'tracking-widest': 'letter-spacing: 0.1em;',
        'truncate': 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        'whitespace-nowrap': 'white-space: nowrap;',
        'antialiased': '-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;',
        'tabular-nums': 'font-variant-numeric: tabular-nums;',
        'rounded': 'border-radius: 0.25rem;',
        'rounded-lg': 'border-radius: 0.5rem;',
        'rounded-xl': 'border-radius: 0.75rem;',
        'rounded-2xl': 'border-radius: 1rem;',
        'rounded-full': 'border-radius: 9999px;',
        'shadow-sm': 'box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);',
        'shadow-md': 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -2px rgba(0, 0, 0, 0.2);',
        'shadow-lg': 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.25);',
        'shadow-2xl': 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);',
        'shadow-inner': 'box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.2);',
        'shadow-black/40': 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);',
        'shadow-amber-500/20': 'box-shadow: 0 4px 12px -1px rgba(245, 158, 11, 0.2);',
        'shadow-amber-950/50': 'box-shadow: 0 10px 25px -5px rgba(69, 26, 3, 0.5);',
        'shadow-emerald-950/50': 'box-shadow: 0 10px 25px -5px rgba(2, 44, 34, 0.5);',
        'shadow-red-950/50': 'box-shadow: 0 10px 25px -5px rgba(69, 10, 10, 0.5);',
        'shadow-slate-950/50': 'box-shadow: 0 10px 25px -5px rgba(2, 6, 23, 0.5);',
        'ring-1': 'box-shadow: 0 0 0 1px var(--tw-ring-color, rgba(245, 158, 11, 0.5));',
        'ring-2': 'box-shadow: 0 0 0 2px var(--tw-ring-color, rgba(245, 158, 11, 0.5));',
        'ring-amber-500': '--tw-ring-color: #f59e0b;',
        'ring-amber-500/30': '--tw-ring-color: rgba(245, 158, 11, 0.3);',
        'ring-emerald-500/30': '--tw-ring-color: rgba(16, 185, 129, 0.3);',
        'ring-red-500/30': '--tw-ring-color: rgba(239, 68, 68, 0.3);',
        'ring-red-500/50': '--tw-ring-color: rgba(239, 68, 68, 0.5);',
        'outline-none': 'outline: 2px solid transparent; outline-offset: 2px;',
        'opacity-0': 'opacity: 0;',
        'opacity-40': 'opacity: 0.4;',
        'opacity-100': 'opacity: 1;',
        'backdrop-blur-sm': 'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);',
        'backdrop-blur-md': 'backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);',
        'transition': 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;',
        'transition-all': 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;',
        'transition-colors': 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;',
        'transition-transform': 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;',
        'duration-150': 'transition-duration: 150ms;',
        'duration-200': 'transition-duration: 200ms;',
        'ease-in': 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1);',
        'ease-out': 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1);',
        'scale-95': 'transform: scale(0.95);',
        'scale-100': 'transform: scale(1);',
        'scale-[0.98]': 'transform: scale(0.98);',
        'translate-y-0': 'transform: translateY(0px);',
        'translate-y-2': 'transform: translateY(0.5rem);',
        'cursor-pointer': 'cursor: pointer;',
        'cursor-not-allowed': 'cursor: not-allowed;',
        'pointer-events-none': 'pointer-events: none;',
        'pointer-events-auto': 'pointer-events: auto;',
        'group': '',
        'no-scrollbar': '',
        'table-contain': '',
    }
    if base in static_map:
        return static_map[base]

    if base.startswith('gap-'):
        sp = SPACING.get(base[4:])
        if sp: return f"gap: {sp};"

    return None

def extract_classes():
    files = ['index.html'] + glob.glob('js/**/*.js', recursive=True)
    text = '\n'.join(open(f, encoding='utf-8').read() for f in files)
    candidates = set()
    for m in re.findall(r'(?<![:\w])class="([^"]+)"', text):
        candidates.update(m.split())
    for m in re.findall(r':class="([^"]+)"', text):
        for s in re.findall(r"'([a-z0-9_/:.\[\]\s-]+)'", m):
            candidates.update(s.split())
    for attr in ['enter', 'enter-start', 'enter-end', 'leave', 'leave-start', 'leave-end']:
        for m in re.findall(rf'x-transition:{attr}="([^"]+)"', text):
            candidates.update(m.split())
    return sorted(set(c.strip("',:()") for c in candidates if c.strip("',:()")))

PREFLIGHT = """/* Tailwind CSS v3 Preflight + Compiled Utilities (Generated by scripts/build_css.py) */
*, ::before, ::after {
    box-sizing: border-box;
    border-width: 0;
    border-style: solid;
    border-color: #222836;
}
html {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
body {
    margin: 0;
    line-height: inherit;
}
hr {
    height: 0;
    color: inherit;
    border-top-width: 1px;
}
h1, h2, h3, h4, h5, h6 {
    font-size: inherit;
    font-weight: inherit;
    margin: 0;
}
p {
    margin: 0;
}
a {
    color: inherit;
    text-decoration: inherit;
}
b, strong {
    font-weight: bolder;
}
code, kbd, samp, pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 1em;
}
table {
    text-indent: 0;
    border-color: inherit;
    border-collapse: collapse;
}
button, input, optgroup, select, textarea {
    font-family: inherit;
    font-feature-settings: inherit;
    font-variation-settings: inherit;
    font-size: 100%;
    font-weight: inherit;
    line-height: inherit;
    color: inherit;
    margin: 0;
    padding: 0;
    background-color: transparent;
}
button, select {
    text-transform: none;
}
button, [type='button'], [type='reset'], [type='submit'] {
    -webkit-appearance: button;
    background-image: none;
    cursor: pointer;
}
:-moz-focusring {
    outline: auto;
}
svg {
    display: block;
    vertical-align: middle;
}
input::placeholder, textarea::placeholder {
    opacity: 1;
    color: #6b7280;
}
"""

def build():
    classes = extract_classes()
    base_rules = []
    media_rules = {bp: [] for bp in BREAKPOINTS}
    unmatched = []

    for cls in classes:
        parts = cls.split(':')
        base = parts[-1]
        prefixes = parts[:-1]

        compiled = compile_base_utility(base)
        if compiled is None:
            # Skip non-Tailwind JS identifiers captured from :class expressions
            if base in ('All', 'inventory', 'reports', 'recipes', 'settings', 'analytics', 'orders', 'value', 'volume', 'success', 'error', 'warning', 'info', 'Synced', 'failed'):
                continue
            unmatched.append(cls)
            continue
        if compiled == '':
            continue

        sel = '.' + escape_selector(cls)
        bp = None
        for p in prefixes:
            if p in BREAKPOINTS:
                bp = p
            elif p in ('hover', 'focus', 'focus-visible', 'active', 'disabled'):
                sel = f"{sel}:{p}"
            elif p == 'selection':
                sel = f"{sel} *::selection, {sel}::selection"
            elif p == 'group-hover':
                sel = f".group:hover {sel}"

        if isinstance(compiled, tuple) and compiled[0].startswith('CHILD:'):
            child_sel = compiled[0][6:]
            rule = f"{sel} {child_sel} {{ {compiled[1]} }}"
        else:
            rule = f"{sel} {{ {compiled} }}"

        if bp:
            media_rules[bp].append(rule)
        else:
            base_rules.append(rule)

    if unmatched:
        raise RuntimeError(f"Unmatched Tailwind classes: {unmatched}")

    out = [PREFLIGHT]
    out.extend(base_rules)
    for bp, width in BREAKPOINTS.items():
        if media_rules[bp]:
            out.append(f"@media (min-width: {width}) {{")
            for r in media_rules[bp]:
                out.append(f"    {r}")
            out.append("}")

    os.makedirs('css', exist_ok=True)
    with open('css/tailwind.css', 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')

    print(f"Built css/tailwind.css ({os.path.getsize('css/tailwind.css')} bytes, {len(base_rules) + sum(len(v) for v in media_rules.values())} rules, 0 unmatched classes)")

if __name__ == '__main__':
    build()
