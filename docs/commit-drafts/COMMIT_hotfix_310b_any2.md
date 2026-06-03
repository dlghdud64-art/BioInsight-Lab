fix(api): §11.310b implicit any g — vendorGroups.map type annotation

groupBy map (g) 인라인 타입 명시 (pre-push build gate 해소).

Fix: vendorGroups.map((g: { vendorName, _count, _max }) => ...)