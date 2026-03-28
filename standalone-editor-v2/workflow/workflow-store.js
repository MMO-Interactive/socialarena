(function attachV2WorkflowStore(globalScope) {
  function createInitialWorkflowState() {
    return {
      currentStageId: "idea_board",
      stages: globalScope.CreatorAppV2Workflow.STAGES.map((stage, index) => ({
        ...stage,
        stepNumber: index + 1,
        status: index === 0 ? "active" : "locked"
      })),
      rewriteStatus: "foundation",
      notice: "V2 rewrite scaffold initialized."
    };
  }

  function setCurrentStage(store, stageId) {
    const current = globalScope.CreatorAppV2Workflow.getStageById(stageId);
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        currentStageId: current.id,
        stages: state.workflow.stages.map((stage) => ({
          ...stage,
          status: stage.id === current.id ? "active" : "ready"
        }))
      }
    }));
  }

  globalScope.CreatorAppV2Workflow = globalScope.CreatorAppV2Workflow || {};
  globalScope.CreatorAppV2Workflow.createInitialWorkflowState = createInitialWorkflowState;
  globalScope.CreatorAppV2Workflow.setCurrentStage = setCurrentStage;
})(window);
