---
title: "Infinity Fabric"
date: 2022-05-28 21:36:06
slug: "Inifinity-Fabric"
categories:
  - "CPU"
---

# Infinity Fabric

## 1. Definition

**Infinity Fabric** (**IF**) is a proprietary system [interconnect architecture](https://en.wikichip.org/wiki/interconnect_architecture) that facilitates data and control transmission across all linked components. This architecture is utilized by [AMD](https://en.wikichip.org/wiki/AMD)'s recent microarchitectures for both CPU (i.e., [Zen](https://en.wikichip.org/wiki/amd/microarchitectures/zen)) and graphics (e.g., [Vega](https://en.wikichip.org/wiki/amd/microarchitectures/vega)), and any other additional accelerators they might add in the future. The fabric was first announced and detailed in April 2017 by Mark Papermaster, AMD's SVP and CTO.

## 2. Communication planes

The Infinity Fabric consists of two separate communication planes - Infinity **Scalable Data Fabric** (**SDF**) and the Infinity **Scalable Control Fabric** (**SCF**). 

- The SDF is the primary means by which data flows around the system between endpoints (e.g. [NUMA nodes](https://en.wikichip.org/w/index.php?title=NUMA_node&action=edit&redlink=1), [PHYs](https://en.wikichip.org/w/index.php?title=PHY&action=edit&redlink=1)). The SDF might have dozens of connecting points hooking together things such as [PCIe](https://en.wikichip.org/w/index.php?title=PCIe&action=edit&redlink=1) PHYs, [memory controllers](https://en.wikichip.org/w/index.php?title=memory_controller&action=edit&redlink=1), USB hub, and the various computing and execution units. The SDF is a [superset](https://en.wikichip.org/w/index.php?title=superset&action=edit&redlink=1) of what was previously [HyperTransport](https://en.wikichip.org/w/index.php?title=HyperTransport&action=edit&redlink=1).
- The SCF is a complementary plane that **handles the transmission of the many miscellaneous system control signals** - this includes things such as thermal and power management, tests, security, and 3rd party IP. With those two planes, AMD can efficiently scale up many of the basic computing blocks.

![image-20220527200854965](image-20220527200854965.png)

## 3. Scalable Data Fabric (SDF)

The Infinity Scalable Data Fabric (SDF) is the data communication plane of the Infinity Fabric. All data from and to the cores and to the other peripherals (e.g. memory controller and I/O hub) are routed through the SDF. A key feature of the coherent data fabric is that it's not limited to a single die and can extend over multiple dies in an [MCP](https://en.wikichip.org/w/index.php?title=MCP&action=edit&redlink=1) as well as multiple sockets over PCIe links (possibly even across independent systems, although that's speculation). There's also no constraint on the topology of the nodes connected over the fabric, communication can be done directly node-to-node, island-hopping in a [bus topology](https://en.wikichip.org/w/index.php?title=bus_topology&action=edit&redlink=1), or as a [mesh topology](https://en.wikichip.org/w/index.php?title=mesh_topology&action=edit&redlink=1) system.

In the case of AMD's processors based on the [Zeppelin](https://en.wikichip.org/wiki/amd/zeppelin) SoC and the [Zen core](https://en.wikichip.org/wiki/amd/microarchitectures/zen), the block diagram of the SDF is shown on the right. The two [CCX's](https://en.wikichip.org/w/index.php?title=amd/cpu_complex&action=edit&redlink=1) are directly connected to the SDF plane using the **Cache-Coherent Master** (**CCM**) which provides the mechanism for coherent data transports between cores. There is also a single **I/O Master/Slave** (IOMS) interface for the I/O Hub communication. The Hub contains two [PCIe](https://en.wikichip.org/w/index.php?title=PCIe&action=edit&redlink=1) controllers, a [SATA](https://en.wikichip.org/w/index.php?title=SATA&action=edit&redlink=1) controller, the [USB](https://en.wikichip.org/w/index.php?title=USB&action=edit&redlink=1) controllers, [Ethernet](https://en.wikichip.org/w/index.php?title=Ethernet&action=edit&redlink=1) controller, and the [southbridge](https://en.wikichip.org/w/index.php?title=southbridge&action=edit&redlink=1). From an operational point of view, the IOMS and the CCMs are actually the only interfaces that are capable of making DRAM requests.

The DRAM is attached to the DDR4 interface which is attached to the **Unified Memory Controller** (UMC). There are two Unified Memory Controllers (UMC) for each of the DDR channels which are also directly connected to the SDF. It's worth noting that all SDF components run at the DRAM's MEMCLK frequency. For example, a system using DDR4-2133 would have the entire SDF plane operating at 1066 MHz. This is a fundamental design choice made by AMD in order to eliminate clock-domain latency.

![image-20220527200935969](image-20220527200935969.png)

### CAKE

The workhorse mechanism that interfaces between the SDF and the various SerDes that link both multiple [dies](https://en.wikichip.org/wiki/dies) together and multiple chips together is the CAKE. The **Coherent AMD socKet Extender** (**CAKE**) module encodes local SDF requests onto 128-bit serialized packets each cycle and ships them over any SerDes interface. Responses are also decoded by the CAKE back to the SDF. As with everything else that is attached to the SDF, the CAKEs operate at DRAM’s MEMCLK frequency in order to eliminate clock-domain crossing latency.

### SerDes

[![img](300px-amd_if-ifop-serdes.png)](https://en.wikichip.org/wiki/File:amd_if-ifop-serdes.png)

IFOP SerDes

The Infinity Scalable Data Fabric (SDF) employs two different types of [SerDes](https://en.wikichip.org/w/index.php?title=SerDes&action=edit&redlink=1) links - **Infinity Fabric On-Package** (**IFOP**) and **Infinity Fabric InterSocket** (**IFIS**).

#### IFOP

The **Infinity Fabric On-Package** (**IFOP**) SerDes deal with die-to-die communication in the same package. AMD designed a fairly straightforward custom SerDes suitable for short in-package trace lengths which can achieve a power efficiency of roughly 2 pJ/b. This was done by using a 32-bit low-swing [single-ended](https://en.wikichip.org/w/index.php?title=single-ended&action=edit&redlink=1) data transmission with differential clocking which consumes roughly half the power of an equivalent differential drive. They utilize a zero-power driver state from the TX/RX impedance termination to the ground while the driver pull-up is disabled. This allows transmitting zeros with less power than transmitting ones which is also leveraged when the link is idle. Additionally [inversion encoding](https://en.wikichip.org/w/index.php?title=inversion_encoding&action=edit&redlink=1) was used to save another 10% average power per bit.

Due to the performance sensitivity of the on-package links, the IFOP links are over-provisioned by about a factor of two relative to DDR4 channel bandwidth for mixed read/write traffic. They are bidirectional links and a CRC is transmitted along with every cycle of data. The IFOP SerDes do four transfers per CAKE clock.

![image-20220527201127718](image-20220527201127718.png)

Since the CAKEs operate at the same frequency as the DRAM's MEMCLK frequency, the bandwidth is fully dependent on that. For a system using DDR4-2666 DIMMs, this means the CAKEs will be operating at 1333.33 MHz meaning the IFOPs will have a bi-directional bandwidth of 42.667 GB/s (= 16B per clock per direction).

#### IFIS

**Infinity Fabric InterSocket** (**IFIS**) SerDes are the second type which are used for package-to-package communications such as in two-way [multiprocessing](https://en.wikichip.org/wiki/multiprocessing). The IFIS were designed so they could [multiplexed](https://en.wikichip.org/wiki/multiplexed) with other protocols such as [PCIe](https://en.wikichip.org/w/index.php?title=PCIe&action=edit&redlink=1) and [SATA](https://en.wikichip.org/w/index.php?title=SATA&action=edit&redlink=1). They operate on TX/RX 16 [differential](https://en.wikichip.org/w/index.php?title=differential&action=edit&redlink=1) data lanes at roughly 11 pJ/b. Those links are also aligned with the [package](https://en.wikichip.org/w/index.php?title=package&action=edit&redlink=1) [pinout](https://en.wikichip.org/w/index.php?title=pinout&action=edit&redlink=1) of standard PCIe lanes. Because they are 16-bit wide they run at 8 transfers per CAKE clock. Compared to the IFOP, the IFIS links have 8/9 of the bandwidth.

![image-20220527201135417](image-20220527201135417.png)

For a system using DDR4-2666 DIMMs, the CAKEs will be operating at 1333.33 MHz meaning the IFIS will have a bidirectional bandwidth of 37.926 GB/s.

## 4. Scalable Control Fabric (SCF)

![image-20220528201737399](image-20220528201737399.png)

The Infinity **Scalable Control Fabric** (**SCF**) is the control communication plane of the Infinity Fabric. The SCF connects the System Management Unit (SMU) to all the various components. The SCF has its own dedicated IFIS SerDes that allows the SCF of multiple chips within a system to talk to each other. The SCF also extends to the dies on a second socket in multi-way [multiprocessing](https://en.wikichip.org/wiki/multiprocessing) configurations.

### Zen[[edit](https://en.wikichip.org/w/index.php?title=amd/infinity_fabric&action=edit&section=9)]

![image-20220528213556148](image-20220528213556148.png)

The Zen cores are incorporated into AMD's [Zeppelin](https://en.wikichip.org/wiki/amd/zeppelin) which is designed to scale from a single-die configuration all the way to a 4-die multi-chip package. Each Zeppelin consists of four IFOPs SerDes and two IFISs SerDes as described above.

In a four-die multi-chip package, such as in the case of [EPYC](https://en.wikichip.org/wiki/amd/epyc), two of the dies are rotated 180 degrees with each die being linked directly to all the other dies in the package. Assuming the system is using DDR4-2666 (i.e., DRAM's MEMCLK is 1333.33 MHz), each of the die-to-die links have a bandwidth of 42.667 GB/s and a total system bisectional bandwidth of 170.667 GB/s.

![image-20220528213605888](image-20220528213605888.png)