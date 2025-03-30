import { useContext } from './useContext';
import { ReorderableCellContext } from '../contexts';

export const useCollapsible = () => {
  const { collapseHandler } = useContext(ReorderableCellContext);
  return collapseHandler;
};
