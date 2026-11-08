import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendEnabled } from '../config';
import { HybridRepository, type ChainRepository } from './repository';
import { supabaseTransport } from './supabaseTransport';

let repo: ChainRepository | null = null;
/** The app-wide repository. Offline (share codes only) until EXPO_PUBLIC_SUPABASE_* is configured. */
export function getRepository(): ChainRepository {
  if (!repo) {
    repo = new HybridRepository(
      { get: (k) => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) },
      backendEnabled ? supabaseTransport : null,
    );
  }
  return repo;
}
