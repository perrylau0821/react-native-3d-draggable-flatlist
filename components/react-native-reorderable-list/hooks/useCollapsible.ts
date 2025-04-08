import { useContext } from './useContext';
import { ReorderableCellContext } from '../contexts';

export const useCollapsible = () => {
  const { collapseHandler, isCollapsed, nodeType } = useContext(ReorderableCellContext);
  return {
    collapse : collapseHandler, 
    isCollapsed,
    nodeType
  };
};
