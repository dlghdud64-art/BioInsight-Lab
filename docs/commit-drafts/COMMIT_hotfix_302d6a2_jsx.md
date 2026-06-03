fix(dashboard): §11.302d-6a-2-hotfix JSX comment inside && expr — BudgetPredictionWidget

§11.303-hotfix-e 패턴: JSX comment {/* ... */} 를 && expression 내부
단독 child 로 두면 SWC 가 "Cannot find name 'div'" 오류.

Fix: comment 를 && expression 바깥 (sibling) 으로 이동.