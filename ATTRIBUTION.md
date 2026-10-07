# Attribution

## Original Project

**serum2vital** by btesser
- Repository: https://github.com/btesser/serum2vital
- License: GPL-3.0-or-later

## How This Project Uses serum2vital

This project (Serum2Vital Web) is a browser-based interface and runtime adaptation of the original serum2vital command-line tool.

### What is adapted from serum2vital

The following Python modules in converter/serum2vital/ are derived from the original btesser/serum2vital repository:

- `serum1.py` - Serum 1 .fxp binary format parser
- `serum2.py` - Serum 2 .SerumPreset parser
- `serum_params.py` - Parameter tables and curve math
- `serum_tables.py` - Display tables read from Serum plugin
- `mapping.py` - Core Serum to Vital parameter mapping
- `filter_map.py` - Filter type and cutoff/resonance conversions
- `fx_common.py` - Effects conversion (reverb, delay, chorus, distortion)
- `serum2_fx.py` - Serum 2 specific effects
- `wavetables.py` - Wavetable extraction and embedding
- `categorize.py` - Sound type classifier
- `vital_defaults.py` - Default Vital preset template
- `writer.py` - Vital preset output writer

### What is new in this project

- `converter/serum2vital/web_adapter.py` - Browser-facing Python adapter (accepts bytes instead of filesystem paths)
- All TypeScript/React source code in `src/`
- Web Worker runtime
- Pyodide integration
- Browser UI

### Copyright Notices

Original copyright notices are preserved in all copied and adapted files as required by GPL-3.0-or-later.

## License

This project is licensed under GPL-3.0-or-later.
See LICENSE file for the full license text.

The original serum2vital project is also licensed under GPL-3.0-or-later:
https://github.com/btesser/serum2vital/blob/main/LICENSE