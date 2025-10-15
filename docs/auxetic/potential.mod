
# NOTE: This script can be modified for different pair styles 
# See in.elastic for more info.

# Setup neighbor style
neighbor 3.0 nsq
neigh_modify once no every 1 delay 0 check yes
comm_modify cutoff 2.0

# Setup minimization style
min_style	     cg
min_modify	     dmax ${dmax} line quadratic

timestep	0.001


# Setup output
thermo		500
thermo_style custom step temp lx ly lz 
# thermo_style custom step temp atoms vx vy vz
thermo_modify norm no

fix extra all print 50 """{"step": $(step), "lx": $(lx), "ly": $(ly)}""" title "" file output.json screen no