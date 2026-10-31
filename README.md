# SpanCraft 3D – Interactive Stress Analysis Simulator

An AI-assisted mechanical engineering application that transforms uploaded engineering worksheets into interactive 2D diagrams and 3D bridge simulations.

Developed during a Google Gemini hackathon in October 2026.

## Overview

BridgeSim is designed to make structural mechanics more interactive and accessible by allowing users to visualise bridge structures, investigate applied forces and explore how different loading conditions and material properties affect structural behaviour.

Users can upload an engineering worksheet and generate an interactive structural representation, with the ability to explore individual members, joints, forces and stresses.

## Key Features

- **Worksheet Conversion:** Upload engineering worksheets and convert them into interactive 2D structural diagrams.
- **3D Bridge Visualisation:** Explore complete bridge structures in a 3D environment, with visual representations of applied forces and structural stresses.
- **Stress Visualisation:** Colour-coded structural members representing stress utilisation relative to material yield strength.
- **Interactive Joints:** Select individual joints to view free-body diagrams, force vectors and corresponding equilibrium equations.
- **Customisable Loading:** Modify force magnitudes, directions and application locations.
- **Material Customisation:** Change material properties, including Young's modulus and yield strength, to explore their effect on structural behaviour.
- **Structural Analysis:** Calculate nodal displacements, support reactions, internal member forces, stresses and factors of safety.
- **User Interface:** Light and dark modes, alongside customisable simulation settings.

## Engineering & Mathematical Methods

The structural analysis engine uses a Direct Stiffness Method (DSM) approach, based on finite-element principles, to calculate the response of the bridge structure under applied loading.

The solver performs several key operations:

1. **Stiffness Matrix Assembly:** Constructs a global structural stiffness matrix from individual beam element stiffness matrices, incorporating Young's modulus, cross-sectional area, member length and orientation.
2. **Boundary Conditions:** Applies pin, roller and fixed support constraints to the structural model.
3. **Displacement Analysis:** Solves the global equilibrium system, [K]{u} = {F}, using Gaussian elimination with partial pivoting.
4. **Internal Force & Stress Analysis:** Calculates axial member forces, normal stresses and stress utilisation relative to material yield strength.
5. **Buckling & Safety Analysis:** Estimates Euler critical buckling stress and calculates factors of safety.
6. **Joint Equilibrium:** Generates joint-level free-body diagrams and evaluates horizontal and vertical force equilibrium (ΣFx = 0, ΣFy = 0).

## Technologies

- **React:** Interactive application interface.
- **Python:** Application development and supporting functionality.
- **TypeScript:** Structural analysis engine and mathematical calculations.
- **Google Gemini:** AI-assisted application