chrome.runtime.onInstalled.addListener(() => {
  const { onPageChanged, PageStateMatcher, ShowAction } = chrome.declarativeContent;
  const site = { schemes: ["https"], hostEquals: "www.munzee.com" };

  onPageChanged.removeRules(undefined, () => {
    onPageChanged.addRules([{
      id: "munzee-map",
      conditions: [
        new PageStateMatcher({ pageUrl: { ...site, pathEquals: "/map" } }),
        new PageStateMatcher({ pageUrl: { ...site, pathPrefix: "/map/" } }),
      ],
      actions: [new ShowAction()],
    }]);
  });
});
