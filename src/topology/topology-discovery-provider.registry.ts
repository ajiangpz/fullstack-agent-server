import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscoverySource } from '../generated/prisma/enums';
import { ManualTopologyDiscoveryProvider } from './manual-topology-discovery.provider';
import type { TopologyDiscoveryProvider } from './topology-discovery-provider';

@Injectable()
export class TopologyDiscoveryProviderRegistry {
  private readonly providers = new Map<
    DiscoverySource,
    TopologyDiscoveryProvider
  >();

  constructor(manualProvider: ManualTopologyDiscoveryProvider) {
    this.providers.set(manualProvider.source, manualProvider);
  }

  get(source: DiscoverySource): TopologyDiscoveryProvider {
    const provider = this.providers.get(source);
    if (!provider) {
      throw new BadRequestException(
        'Discovery source ' + source + ' is not configured',
      );
    }
    return provider;
  }
}
