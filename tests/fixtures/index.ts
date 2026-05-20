/**
 * Combined fixture export — merge all fixtures into a single `test` object.
 * Import from here instead of individual fixture files.
 */
import { mergeTests, mergeExpects } from '@playwright/test';
import { test as authTest, expect as authExpect } from './auth.fixture';
import { test as walletTest, expect as walletExpect } from './wallet.fixture';
import { test as multiplayerTest, expect as multiplayerExpect } from './multiplayer.fixture';

export const test = mergeTests(authTest, walletTest, multiplayerTest);
export const expect = mergeExpects(authExpect, walletExpect, multiplayerExpect);
