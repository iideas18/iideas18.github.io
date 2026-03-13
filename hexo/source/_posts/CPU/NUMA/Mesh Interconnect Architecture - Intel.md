---
title: "**Mesh Interconnect Architecture - Intel**"
date: 2022-11-05 10:46:17
slug: "Mesh Interconnect Architecture - Intel"
categories:
  - "CPU"
  - "NUMA"
---

# **Mesh Interconnect Architecture - Intel**

Intel's **mesh interconnect architecture** is a [multi-core](https://en.wikichip.org/wiki/multi-core) system [interconnect architecture](https://en.wikichip.org/wiki/interconnect_architecture) that implements a [synchronous](https://en.wikichip.org/w/index.php?title=synchronous&action=edit&redlink=1), high-bandwidth, and [scalable](https://en.wikichip.org/w/index.php?title=scalable&action=edit&redlink=1) 2-dimensional array of half rings. Their mesh architecture has replaced the [ring interconnect architecture](https://en.wikichip.org/w/index.php?title=intel/ring_interconnect_architecture&action=edit&redlink=1) in the server and [HPC](https://en.wikichip.org/w/index.php?title=HPC&action=edit&redlink=1) markets.

## History

Throughout the 2010s as the number of cores on Intel's high-end models continue to increase, the ring reached fairly problematic scaling issues, particularly in the area of bandwidth and latency.

A mesh networking topology in order to reduce the latency between nodes and increase the bandwidth.

For example, the 80 [many-core](https://en.wikichip.org/wiki/many-core) [Polaris](https://en.wikichip.org/wiki/intel/microarchitectures/polaris) processor from [2007](https://en.wikichip.org/wiki/2007) featured a mesh interconnect architecture with a 5-port router on each tile. Polaris was the very first research chip in the area of teraFLOP computing which eventually resulted in the [Xeon Phi](https://en.wikichip.org/wiki/intel/xeon_phi) family of commercial processors. 

In June [2016](https://en.wikichip.org/wiki/2016), Intel launched new [Xeon Phi](https://en.wikichip.org/wiki/intel/xeon_phi) [MIC](https://en.wikichip.org/wiki/intel/mic_architecture) microprocessors based on [Knights Landing](https://en.wikichip.org/wiki/intel/microarchitectures/knights_landing) which was Intel's first commercialized microarchitecture to implement the new interconnect architecture. 

In mid-[2017](https://en.wikichip.org/wiki/2017) Intel launched the [Skylake server microarchitecture](https://en.wikichip.org/wiki/intel/microarchitectures/skylake_(server)) which featured also featured the mesh interconnect. This microarchitecture is found in their server ([Xeon Scalable](https://en.wikichip.org/wiki/intel/xeon_scalable)) microprocessors and the [Core i7](https://en.wikichip.org/wiki/intel/core_i7) and [Core i9](https://en.wikichip.org/wiki/intel/core_i9) HEDT parts.

## Overview

Intel's mesh interconnect architecture consists of a number of related concepts:

- **Mesh** - the fabric, a 2-dimensional array of half rings forming a system-wide interconnect grid
- Tile - a modular IP block that can be replicated multiple times across a large grid
  - **Core Tile** - a specific kind of tile that incorporates an Intel's [x86](https://en.wikichip.org/wiki/x86) core
  - **IMC Tile** - a specific kind of tile that incorporates an [integrated memory controller](https://en.wikichip.org/w/index.php?title=integrated_memory_controller&action=edit&redlink=1)
- **Caching/Home Agent** (**CHA**) - a unit found inside the core tiles that maintains the cache coherency between tiles. The CHA also interfaces with the CMS
- **Converged/Common Mesh Stop** (**CMS**) - A mesh stop station, facilitating the interface between a tile and the fabric

![intel mesh overview.svg](https://en.wikichip.org/w/images/thumb/1/1b/intel_mesh_overview.svg/600px-intel_mesh_overview.svg.png)

Tiles are replicated in the X and Y axis as many times as desired. The type of tile depends on the design goals and target market. In theory any type of IP block can serve as a tile provided it's modified to interface with the CMS. Each tile is associated with its own CMS which allows the tile to interface with the mesh. Every mesh stop at each tile is directly connected to its immediate four neighbors – north, south, east, and west.

![intel mesh cms links.svg](https://en.wikichip.org/w/images/thumb/c/c9/intel_mesh_cms_links.svg/200px-intel_mesh_cms_links.svg.png)

he mesh itself consists of a 2-dimensional array of half-rings. Every vertical column of CMSs form a bi-directional half ring. Similarly, every horizontal row forms a bi-directional half ring.

**Horizontal bi-directional half rings**
[![intel mesh cms links (horizontal).svg](https://en.wikichip.org/w/images/thumb/6/69/intel_mesh_cms_links_%28horizontal%29.svg/200px-intel_mesh_cms_links_%28horizontal%29.svg.png)](https://en.wikichip.org/wiki/File:intel_mesh_cms_links_(horizontal).svg)

**Vertical bi-directional half rings**
[![intel mesh cms links (vertical).svg](https://en.wikichip.org/w/images/thumb/8/80/intel_mesh_cms_links_%28vertical%29.svg/200px-intel_mesh_cms_links_%28vertical%29.svg.png)](https://en.wikichip.org/wiki/File:intel_mesh_cms_links_(vertical).svg)

## Operations



A packet follows a simple routing algorithm:

- Packets are 1st routed vertically
- Packets are then routed horizontally

A packet originates at a tile (e.g. from the CHA) or some an I/O peripheral. It enters the fabric at its local Mesh Stop (CMS). The packet is then routed along the vertical half ring, either north or south, always taking the shortest path. Once the packet reaches its destination row, it will be taken off the vertical half ring and placed on the horizontal half ring where it will continue to the destination tile. Once the packet reaches the destination tile, it will interface back with the tile via Mesh Stop.

### Example

Consider the 5 by 6 example mesh below. For a packet to go from the tile labeled 'Start' to the [IMC](https://en.wikichip.org/w/index.php?title=integrated_memory_controller&action=edit&redlink=1), the packet will leave the core via the CHA and onto the mesh via the CMS. The packet will then be routed through three stops going north. The packet will then be taken off the vertical half ring and placed on the horizontal half ring where it will continue three additional stops going east to the IMC.

![intel mesh example start.svg](https://en.wikichip.org/w/images/thumb/7/78/intel_mesh_example_start.svg/350px-intel_mesh_example_start.svg.png)

It's important to note that the return path may not be the same route as before. For example, as in this situation, a response from the IMC will be routed via the vertical half ring first to the very south-east corner tile. The packet will then be taken off the vertical half ring and placed on the horizontal half ring where it will go west until it reaches the destination tile.

![intel mesh example return.svg](https://en.wikichip.org/w/images/thumb/e/ee/intel_mesh_example_return.svg/350px-intel_mesh_example_return.svg.png)