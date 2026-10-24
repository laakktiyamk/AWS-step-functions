# ./ml/scripts/run-batch_temp.sh 


#aws stepfunctions list-state-machines \
#  --profile AWS-step-functions \
#  --region eu-north-1 \
#  --query "stateMachines[].[name,stateMachineArn]" \
#  --output table

aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:eu-north-1:223057859479:stateMachine:ndviWorkflow \
  --name ml-season2026-01-$(date +%s) \
  --input file://sf-inputs-2026/sf-input-01.json \
  --profile AWS-step-functions \
  --region eu-north-1
