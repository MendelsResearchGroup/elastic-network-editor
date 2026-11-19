# Negative thermal expansion in a square spring lattice

[Run the network in the editor](https://mendelsresearchgroup.github.io/elastic-network-editor/?example=negative-thermal-expansion). The simulation starts automatically. After both temperature plateaus, read **Time-averaged thermal response**. The instantaneous area fluctuates with the barostat, so compare the two reported means.

The [input](lattice.lmp) contains a periodic 6 × 6 square lattice with harmonic edge springs (coefficient 20, rest length 1) and softer diagonal braces (0.5, √2). Transverse fluctuations can shorten the projected spacing between neighbors even when stretching an individual spring costs energy. This example uses its own parameters and tests the sign of the two-dimensional area response. For the square-lattice mechanism, see [Mao et al., *Mechanical instability at finite temperature* (2015)](https://doi.org/10.1038/ncomms6968).

The [LAMMPS protocol](../../public/nte.deformation) holds external pressure at zero with isotropic in-plane dilation. At each target temperature it equilibrates for 20,000 steps, then averages area and kinetic temperature every ten steps for another 20,000 steps. The time step is 0.004 in Lennard-Jones reduced units.

| Initial velocity seed | Cold mean T | Hot mean T | Cold mean area | Hot mean area | Area change |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1001 (website) | 0.00204 | 0.04045 | 35.9969 | 35.8923 | −0.291% |
| 2003 | 0.00198 | 0.03948 | 35.9943 | 35.8319 | −0.451% |
| 3001 | 0.00199 | 0.04020 | 35.9958 | 35.8961 | −0.277% |

All three seeds show a smaller mean area at the higher temperature in lammps.js 1.6.2. These finite-cell, two-temperature results demonstrate contraction over the sampled interval. They do not establish a bulk material coefficient.

From the repository root, run `npm ci` followed by `node examples/negative-thermal-expansion/reproduce.mjs` with Node 24. The script imports and exports the same graph as the editor and runs all three seeds with the site's simulation input.
