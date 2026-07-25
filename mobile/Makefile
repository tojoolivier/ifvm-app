# Makefile — IFVM mobile (Expo SDK 56 / bare workflow)
# `make help` pour la liste des cibles.

.DEFAULT_GOAL := help
.PHONY: help install pods pods-clean start start-clean ios android web \
        lint test resync clean nuke doctor

## Affiche cette aide
help:
	@awk '/^## /{d=substr($$0,4)} /^[a-zA-Z_-]+:/{split($$0,a,":");if(d)printf "\033[36m%-14s\033[0m %s\n",a[1],d;d=""}' $(MAKEFILE_LIST)

## Installe les dépendances JS
install:
	npm install

## Installe les Pods iOS (contre le node_modules actuel)
pods:
	cd ios && pod install

## Régénère proprement les Pods (à faire après tout changement de node_modules)
pods-clean:
	cd ios && rm -rf Pods Podfile.lock && pod install

## Resync complet JS + Pods — le réflexe après un npm install sur projet bare
resync: install pods-clean
	@echo "✅ node_modules et Pods iOS resynchronisés."

## Démarre Metro
start:
	npx expo start

## Démarre Metro en vidant le cache (erreurs de résolution de module)
start-clean:
	npx expo start -c

## Build + lance l'app iOS
ios:
	npx expo run:ios

## Build + lance l'app Android
android:
	npx expo run:android

## Metro en mode web
web:
	npx expo start --web

## Lint
lint:
	npx expo lint

## Tests Jest
test:
	npm test

## Diagnostic Expo (versions, config natives)
doctor:
	npx expo-doctor

## Purge caches Metro/Xcode sans toucher aux deps
clean:
	rm -rf $$TMPDIR/metro-* $$TMPDIR/haste-map-* node_modules/.cache
	rm -rf $$HOME/Library/Developer/Xcode/DerivedData/*
	@echo "✅ Caches Metro et Xcode DerivedData purgés."

## Reset radical : supprime node_modules + Pods, réinstalle tout
nuke:
	rm -rf node_modules ios/Pods ios/Podfile.lock package-lock.json
	npm install
	cd ios && pod install
	@echo "✅ Reset complet terminé."
