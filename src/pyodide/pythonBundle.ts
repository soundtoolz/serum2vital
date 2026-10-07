// Static raw imports of all Python modules for Pyodide in-memory filesystem
import initPy from '../../converter/serum2vital/__init__.py?raw'
import categorizePy from '../../converter/serum2vital/categorize.py?raw'
import filterMapPy from '../../converter/serum2vital/filter_map.py?raw'
import fxCommonPy from '../../converter/serum2vital/fx_common.py?raw'
import mappingPy from '../../converter/serum2vital/mapping.py?raw'
import serum1Py from '../../converter/serum2vital/serum1.py?raw'
import serum2Py from '../../converter/serum2vital/serum2.py?raw'
import serum2FxPy from '../../converter/serum2vital/serum2_fx.py?raw'
import serumParamsPy from '../../converter/serum2vital/serum_params.py?raw'
import serumTablesPy from '../../converter/serum2vital/serum_tables.py?raw'
import vitalDefaultsPy from '../../converter/serum2vital/vital_defaults.py?raw'
import wavetablesPy from '../../converter/serum2vital/wavetables.py?raw'
import webAdapterPy from '../../converter/serum2vital/web_adapter.py?raw'
import writerPy from '../../converter/serum2vital/writer.py?raw'

export const PYTHON_BUNDLE: Record<string, string> = {
  '__init__.py': initPy,
  'serum1.py': serum1Py,
  'serum2.py': serum2Py,
  'serum_params.py': serumParamsPy,
  'serum_tables.py': serumTablesPy,
  'mapping.py': mappingPy,
  'filter_map.py': filterMapPy,
  'fx_common.py': fxCommonPy,
  'serum2_fx.py': serum2FxPy,
  'wavetables.py': wavetablesPy,
  'vital_defaults.py': vitalDefaultsPy,
  'writer.py': writerPy,
  'categorize.py': categorizePy,
  'web_adapter.py': webAdapterPy,
}