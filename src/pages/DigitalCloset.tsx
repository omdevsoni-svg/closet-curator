                </label>
                </div>
              )}
            </div>

            {/* AI Detection Status */}
            {aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-ai/10 px-4 py-2.5"
              >
                <Loader2 className="h-4 w-4 animate-spin text-ai" />
                <span className="text-xs font-body text-ai font-medium">
                  AI is analyzing your clothing...
                </span>
              </motion.div>
            )}
            {aiDetected && !aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-2.5"
              >
                <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-body text-green-700 dark:text-green-400 font-medium">
                  AI auto-filled details — review and adjust below
                </span>
              </motion.div>
            )}{aiError && !aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-body text-destructive font-medium">
                  AI detection unavailable — please fill in details manually
                </span>
              </motion.div>
            )}
            {aiRejection && !aiDetecting && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-xl bg-amber-500/10 px-4 py-3"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="text-xs font-body font-semibold text-amber-700 dark:text-amber-300">
                      Not a garment image
                    </span>
                    <p className="mt-0.5 text-[11px] font-body text-amber-600 dark:text-amber-400">
                      {aiRejection}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Item Name */}
            <div className="mt-4">
              <label className="text-xs font-medium font-body uppercase tracking-wider text-muted-foreground">
                Item Name *
              </label>