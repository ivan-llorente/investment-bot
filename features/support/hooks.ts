import { After } from '@cucumber/cucumber';
import type { TradingWorld } from './world.js';

After(function (this: TradingWorld) {
  this.acceptance?.server.close();
});
