

# Lennard-Jones reduced units for auxetic compression
units           lj
dimension       2
atom_style      full

# bonded network mechanics
bond_style      harmonic
angle_style     harmonic
dihedral_style  none
special_bonds   none
boundary        p p p

# set a unit mass for the single atom type in reduced units
mass 1 1.0
read_data network.lmp

# Minimisation tolerances tuned for reduced units
variable etol equal 1.0e-8
variable ftol equal 1.0e-8
variable maxiter equal 100000
variable maxeval equal 200000
variable dmax equal 5.0e-3
