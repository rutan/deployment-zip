const DEPLOYMENT_MODES = ['zip', 'copy', 's3'] as const;
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];

export function isDeploymentMode(mode: string): mode is DeploymentMode {
  return DEPLOYMENT_MODES.includes(mode as any);
}
