

# metal units, elastic constants in eV/A^3
#units		metal
#variable cfac equal 6.2414e-7
#variable cunits string eV/A^3

# Choose potential
# metal units, elastic constants in GPa
units		metal
atom_style	full
#pair_style      lj/cut 1.0 
#pair_style      yukawa 1.0 2.0  
#pair_modify     mix arithmetic
bond_style      harmonic
angle_style     harmonic
dihedral_style  zero
special_bonds   amber
variable cfac equal 1.0e-4
variable cunits string GPa
boundary	p p p

# Need to set mass to something, just to satisfy LAMMPS
#mass 1 1.0e-20
read_data network.lmp

# real units, elastic constants in GPa
#units		real
#variable cfac equal 1.01325e-4
#variable cunits string GPa

# Define minimization parameters
variable etol equal 0.0 
variable ftol equal 5.0e-10
variable maxiter equal 100000
variable maxeval equal 20000
variable dmax equal 1.0e-2
