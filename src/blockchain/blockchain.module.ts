import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { StellarPayoutModule } from './stellar/stellar-payout.module';
import { ExternalLedgerEventService } from './services/external-ledger-event.service';
import { ExternalLedgerEventController } from './controllers/external-ledger-event.controller';

@Module({
  imports: [StellarPayoutModule],
  providers: [BlockchainService, ExternalLedgerEventService],
  controllers: [ExternalLedgerEventController],
  exports: [BlockchainService, StellarPayoutModule, ExternalLedgerEventService],
})
export class BlockchainModule { }
