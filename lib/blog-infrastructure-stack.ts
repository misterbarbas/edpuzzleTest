import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elasticloadbalancingv2targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
//import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
//import { Instance } from '@aws-cdk/aws-ec2';
//import { Instance } from '@aws-cdk/aws-cloudwatch';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
//import * as ec2 from '@aws-cdk/aws-ec2';


//This a stack for production

export class BlogInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Defining the vpc with public subnet and private
    const vpc = new ec2.Vpc(this, 'BlogVpc', {
      maxAzs: 3, // For HA accross multiple zones
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        },
      ],
    });
      //Defining the ec2 instance
    const ec2Instance = new ec2.Instance(this, 'BlogInstance', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux(),
      vpc,
    });

      //Defining the RDS for the dynamic content such user comments, blogs etc
    //const dbInstance = new rds.DatabaseInstance(this, 'BlogDatabase', {
      //engine: rds.DatabaseInstanceEngine.postgres({
        //version: rds.PostgresEngineVersion.VER_13_3,
      //}),
      //vpc,
      //multiAz: true,
      //allocatedStorage: 20, // Customize as needed
      //publiclyAccessible: false,
      //databaseName: 'blogDB',
    //});


      // Defining s3 bucket for static content

      const staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'error.html',
      });
      //I decided to put CF to cache static content and increse performance

      new cloudfront.CloudFrontWebDistribution(this, 'BlogCloudFront', {
        originConfigs: [{
          s3OriginSource: {
            s3BucketSource: staticAssetsBucket,
          },
          behaviors: [{ isDefaultBehavior: true }],
        }],
      });

      //Defining certificates

      //const certificate = new acm.Certificate(this, 'BlogCertificate', {
        //domainName: 'edblog.com',
        //validation: acm.CertificateValidation.fromDns(hostedZone),
      //});
      
      //An application loadbalancer to distribute the workloads

      const lb = new elb.ApplicationLoadBalancer(this, 'BlogLoadBalancer', {
        vpc,
        internetFacing: true,
      });

      const Listener = lb.addListener('Listener', {
         port: 80
         //certificates: [certificate],
        
        });;
        const targetGroup = new elb.ApplicationTargetGroup(this, 'BlogTargetGroup', {
          vpc,
          targetType: elb.TargetType.INSTANCE, // Target type is EC2 instances
          port: 80, // Port on which targets are listening
        });

         // addint tg to load balancer
         targetGroup.addTarget(new elasticloadbalancingv2targets.InstanceTarget(ec2Instance));



        // adding tg to the listener
        Listener.addTargetGroups('DefaultTargetGroup', {
          targetGroups: [targetGroup], // Add the target group to the listener
        });
        //Another way to define it
      //const targetGroup = Listener.addTargets('ec2Instance',
        // { port: 80 });
      
      // Allow HTTP access
      ec2Instance.connections.allowFrom(lb, ec2.Port.tcp(80));

      // Allow SSH access
      ec2Instance.connections.allowFrom(lb, ec2.Port.tcp(22));

       // To configure the domain of the website

       const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: 'edblog.com',
      });
      
      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: 'www',
        target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(lb)),
      });

     //Monitoring to fix

     // Define the CPU Utilization Metric for the EC2 instance
    //const cpuUtilizationMetric = ec2.Instance.metricCpuUtilization();

    // Create a CloudWatch Alarm based on the CPU Utilization metric
    //const cpuAlarm = new cloudwatch.Alarm(this, 'CPUUtilizationAlarm', {
      //metric: cpuUtilizationMetric,
      //threshold: 80,  // Trigger the alarm if CPU usage exceeds 80%
      //evaluationPeriods: 2, // Number of periods to evaluate the metric
      //comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      //alarmDescription: 'This alarm is triggered if CPU utilization exceeds 80%.',
    //});
    
    
    //Sending notification

    // Create an SNS topic
const alarmTopic = new sns.Topic(this, 'CpuUtilizationAlarmTopic');

// Add the SNS topic to the CloudWatch alarm
//cpuAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

// You can also add an email subscription to the SNS topic
alarmTopic.addSubscription(new cdk.aws_sns_subscriptions.EmailSubscription('samuelsanso7@hotmail.es'));
    
  }
}