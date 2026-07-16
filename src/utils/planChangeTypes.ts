export type PlanChangeCategoryId =
  | 'conditioning_light'
  | 'conditioning_hard'
  | 'recovery'
  | 'strength_upper'
  | 'strength_lower'
  | 'strength_full'
  | 'accessories';

export type PlanChangeBinScopeId =
  | 'whole_day'
  | 'strength'
  | 'conditioning'
  | 'recovery'
  | 'team';

export type PlanChange =
  | { kind: 'remove_session'; date: string; scope?: PlanChangeBinScopeId }
  | { kind: 'swap_template'; date: string; templateId: string }
  | { kind: 'add_template'; date: string; templateId: string }
  | { kind: 'swap_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'add_category'; date: string; category: PlanChangeCategoryId }
  | { kind: 'move_session'; fromDate: string; toDate: string }
  | { kind: 'shutdown_week'; date: string }
  | { kind: 'clear_days'; dates: string[] };

export type TemplatePlanChange = Extract<
  PlanChange,
  { kind: 'swap_template' | 'add_template' }
>;
