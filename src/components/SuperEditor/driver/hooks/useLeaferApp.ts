import { useContext } from 'react';
import { LeaferAppContext } from '../context';

export default function useLeaferApp() {
  return useContext(LeaferAppContext);
}
