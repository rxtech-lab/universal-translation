import { WaitingListButton } from "./waiting-list-button";
import { AnimateOnScroll } from "./animate-on-scroll";

export function FooterCta({
  isSignedIn,
  signInAction,
  waitingListEnabled,
  isOnWaitingList,
  isApproved,
}: {
  isSignedIn: boolean;
  signInAction: () => Promise<void>;
  waitingListEnabled: boolean;
  isOnWaitingList: boolean;
  isApproved: boolean;
}) {
  return (
    <section className="px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <AnimateOnScroll className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to translate?
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Upload your first file and see AI-powered translation in action.
          </p>
          <div className="mt-8">
            <WaitingListButton
              isSignedIn={isSignedIn}
              signInAction={signInAction}
              waitingListEnabled={waitingListEnabled}
              isOnWaitingList={isOnWaitingList}
              isApproved={isApproved}
            />
          </div>
        </AnimateOnScroll>

        <div className="mt-20 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          Built by RxLab
        </div>
      </div>
    </section>
  );
}
