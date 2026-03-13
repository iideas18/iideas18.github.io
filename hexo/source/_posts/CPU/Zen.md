---
title: "Zen"
date: 2022-05-28 21:57:09
categories:
  - "CPU"
---

# Zen

**Zen** (**family 17h**) is the [microarchitecture](https://en.wikichip.org/wiki/microarchitecture) developed by [AMD](https://en.wikichip.org/wiki/AMD) as a successor to both [Excavator](https://en.wikichip.org/wiki/amd/microarchitectures/excavator) and [Puma](https://en.wikichip.org/w/index.php?title=amd/microarchitectures/puma&action=edit&redlink=1). Zen is an entirely new design, built from the ground up for optimal balance of performance and power capable of covering the entire computing spectrum from fanless notebooks to high-performance desktop computers. Zen was officially launched on March 2, [2017](https://en.wikichip.org/wiki/2017). Zen was replaced by [Zen+](https://en.wikichip.org/wiki/amd/microarchitectures/zen%2B) in [2018](https://en.wikichip.org/wiki/2018).

For performance desktop and mobile computing, Zen is branded as [Athlon](https://en.wikichip.org/wiki/amd/athlon), [Ryzen 3](https://en.wikichip.org/wiki/amd/ryzen_3), [Ryzen 5](https://en.wikichip.org/wiki/amd/ryzen_5), [Ryzen 7](https://en.wikichip.org/wiki/amd/ryzen_7), [Ryzen 9](https://en.wikichip.org/wiki/amd/ryzen_9) and [Ryzen Threadripper](https://en.wikichip.org/wiki/amd/ryzen_threadripper) processors. For servers, Zen is branded as [EPYC](https://en.wikichip.org/wiki/amd/epyc).

*Zen* was picked by Michael Clark, AMD's senior fellow and lead architect. Zen was picked to represent the balance needed between the various competing aspects of a microprocessor - transistor allocation/die size, clock/frequency restriction, power limitations, and new instructions to implement.

## Architecture

## Entire SoC Overview

![image-20220528214053302](image-20220528214053302.png)

## Individual Core

![zen block diagram.svg](1106px-zen_block_diagram.svg.png)

## Single/Multi-chip Packages

### 1. Single-die

Single-die as used in [Summit Ridge](https://en.wikichip.org/wiki/amd/cores/summit_ridge):

![image-20220528214204720](image-20220528214204720.png)

### 2. 2-die MCP[[edit](https://en.wikichip.org/w/index.php?title=amd/microarchitectures/zen&action=edit&section=19)]

2-die MCP used for [Threadripper](https://en.wikichip.org/wiki/amd/threadripper):

![image-20220528214224966](image-20220528214224966.png)

##### 4-die MCP[[edit](https://en.wikichip.org/w/index.php?title=amd/microarchitectures/zen&action=edit&section=20)]

4-die MCP used for [EPYC](https://en.wikichip.org/wiki/amd/epyc):

![image-20220528214245773](image-20220528214245773.png)

**4-die CCX configs**

![image-20220528214329330](image-20220528214329330.png)

## Memory Hierarchy

- Cache
  - L0 µOP cache:
    - 2,048 µOPs, 8-way set associative
      - 32-sets, 8-µOP line size
    - Parity protected
  - L1I Cache:
    - 64 KiB 4-way set associative
      - 256-sets, 64 B line size
      - Shared by the two threads, per core
    - Parity protected
  - L1D Cache:
    - 32 KiB 8-way set associative
      - 64-sets, 64 B line size
      - Write-back policy
    - 4-5 cycles latency for Int
    - 7-8 cycles latency for FP
    - SEC-DED ECC
  - L2 Cache:
    - 512 KiB 8-way set associative
    - 1,024-sets, 64 B line size
    - Write-back policy
    - Inclusive of L1
    - Latency:
      - 17 cycles latency (ONLY [Summit Ridge](https://en.wikichip.org/wiki/amd/cores/summit_ridge))
      - 12 cycles latency (All others)
    - DEC-TED ECC
  - L3 Cache:
    - Victim cache
    - Summit Ridge, Naples: 8 MiB/CCX, shared across all cores.
    - Raven Ridge: 4 MiB/CCX, shared across all cores.
    - 16-way set associative
      - 8,192-sets, 64 B line size
    - 40 cycles latency
    - DEC-TED ECC
  - System DRAM:
    - 2 channels per die
    - Summit Ridge: up to PC4-21300U (DDR4-2666 UDIMM), ECC supported
    - Raven Ridge: up to PC4-23466U (DDR4-2933 UDIMM), ECC supported by PRO models
    - Naples: up to PC4-21300L (DDR4-2666 RDIMM/LRDIMM), ECC supported
    - ECC: x4 DRAM device failure correction (Chipkill), x8 SEC-DED ECC, Patrol and Demand scrubbing, Data poisoning

Zen TLB consists of dedicated level one TLB for instruction cache and another one for data cache.

- TLBs
  - ITLB
    - 8 entry L0 TLB, all page sizes
    - 64 entry L1 TLB, all page sizes
    - 512 entry L2 TLB, no 1G pages
    - Parity protected
  - DTLB
    - 64 entry L1 TLB, all page sizes
    - 1,532-entry L2 TLB, no 1G pages
    - Parity protected