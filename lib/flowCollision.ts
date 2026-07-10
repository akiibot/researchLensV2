export type CollisionRole = 'anchor' | 'group' | 'node';

export interface CollisionNode<TPosition = { x: number; y: number }> {
  id: string;
  position: TPosition;
  width: number;
  height: number;
  role?: CollisionRole;
  selected?: boolean;
  expanded?: boolean;
}

export interface CollisionOptions {
  gap?: number;
  passes?: number;
}

function massFor(node: CollisionNode) {
  if (node.role === 'anchor') return 0.16;
  if (node.role === 'group') return 0.34;
  if (node.selected || node.expanded) return 0.42;
  return 0.5;
}

export function resolveFlowCollisions<T extends CollisionNode>(
  nodes: T[],
  options: CollisionOptions = {}
): T[] {
  const gap = options.gap ?? 34;
  const passes = options.passes ?? 18;
  const resolved = nodes.map((node) => ({
    ...node,
    position: { ...node.position },
  }));

  for (let pass = 0; pass < passes; pass += 1) {
    let changed = false;

    for (let leftIndex = 0; leftIndex < resolved.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < resolved.length; rightIndex += 1) {
        const left = resolved[leftIndex];
        const right = resolved[rightIndex];
        const leftGap = gap + (left.selected || left.expanded ? 12 : 0);
        const rightGap = gap + (right.selected || right.expanded ? 12 : 0);
        const protectedGap = Math.max(leftGap, rightGap);
        const leftBox = {
          left: left.position.x,
          right: left.position.x + left.width,
          top: left.position.y,
          bottom: left.position.y + left.height,
        };
        const rightBox = {
          left: right.position.x,
          right: right.position.x + right.width,
          top: right.position.y,
          bottom: right.position.y + right.height,
        };
        const overlapsX =
          leftBox.left < rightBox.right + protectedGap &&
          leftBox.right + protectedGap > rightBox.left;
        const overlapsY =
          leftBox.top < rightBox.bottom + protectedGap &&
          leftBox.bottom + protectedGap > rightBox.top;

        if (!overlapsX || !overlapsY) continue;

        const leftCenter = {
          x: leftBox.left + left.width / 2,
          y: leftBox.top + left.height / 2,
        };
        const rightCenter = {
          x: rightBox.left + right.width / 2,
          y: rightBox.top + right.height / 2,
        };
        const overlapX =
          Math.min(leftBox.right, rightBox.right) -
          Math.max(leftBox.left, rightBox.left) +
          protectedGap;
        const overlapY =
          Math.min(leftBox.bottom, rightBox.bottom) -
          Math.max(leftBox.top, rightBox.top) +
          protectedGap;
        const separateVertically =
          overlapY <= overlapX || Math.abs(rightCenter.y - leftCenter.y) > 24;
        const leftMass = massFor(left);
        const rightMass = massFor(right);

        if (separateVertically) {
          const direction = rightCenter.y >= leftCenter.y ? 1 : -1;
          left.position.y -= direction * overlapY * leftMass;
          right.position.y += direction * overlapY * rightMass;
        } else {
          const direction = rightCenter.x >= leftCenter.x ? 1 : -1;
          left.position.x -= direction * overlapX * leftMass;
          right.position.x += direction * overlapX * rightMass;
        }

        changed = true;
      }
    }

    if (!changed) break;
  }

  return resolved as T[];
}
